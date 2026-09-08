export interface WebRTCConfig {
  onRemoteStream: (stream: MediaStream) => void;
  onLocalStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onSignal: (type: 'offer' | 'answer' | 'ice-candidate', data: unknown) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  // Primary STUN servers (fast but may not work behind NAT)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  
  // Free TURN servers (slow but reliably work behind NAT/firewall)
  { 
    urls: ['turn:numb.viagee.com:3478', 'turn:numb.viagee.com:3478?transport=tcp'],
    username: 'webrtc@live.com',
    credential: 'muazkh'
  },
];

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: WebRTCConfig;
  private isInitiator = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;

  constructor(config: WebRTCConfig) {
    this.config = config;
  }

  async init(isInitiator: boolean): Promise<void> {
    this.isInitiator = isInitiator;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    console.log('🔧 WebRTC PC initialized as', isInitiator ? 'initiator (caller)' : 'responder');

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        console.log('🔗 Connection state changed:', this.pc.connectionState);
        this.config.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc) {
        console.log('🧊 ICE connection state:', this.pc.iceConnectionState);
      }
    };

    this.pc.onsignalingstatechange = () => {
      if (this.pc) {
        console.log('📡 Signaling state:', this.pc.signalingState);
      }
    };

    this.pc.ontrack = (event) => {
      console.log('🎥 Remote track received:', event.track.kind);
      this.remoteStream = event.streams[0];
      this.config.onRemoteStream(this.remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate found:', event.candidate.candidate);
        this.config.onSignal('ice-candidate', event.candidate.toJSON());
      } else {
        console.log('✅ ICE gathering complete');
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }
    }
  }

  async getLocalStream(withVideo: boolean): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: withVideo ? { facingMode: 'user', width: 1280, height: 720 } : false,
    };

    try {
      console.log('📷 Requesting media with video:', withVideo);
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Verify tracks were actually captured
      const videoTracks = this.localStream.getVideoTracks();
      const audioTracks = this.localStream.getAudioTracks();
      console.log(`✅ Media stream acquired:`, {
        video: videoTracks.length,
        audio: audioTracks.length,
      });
      
      if (withVideo && videoTracks.length === 0) {
        console.warn('⚠️ Video requested but no video track available');
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('❌ Camera/mic access denied:', error.message);
      
      // Try fallback: audio only
      try {
        console.log('📻 Falling back to audio only...');
        this.localStream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: false 
        });
        console.log('✅ Audio fallback successful');
      } catch (audioErr) {
        console.error('❌ Even audio access denied:', audioErr);
        throw audioErr;
      }
    }

    this.config.onLocalStream(this.localStream);
    return this.localStream;
  }

  async getDisplayStream(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    return stream;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    console.log('📤 Creating offer...');
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await this.pc.setLocalDescription(offer);
    console.log('✅ Offer created and set as local description');
    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    try {
      console.log('📥 Handling received offer...');
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      this.remoteDescriptionSet = true;
      console.log(`✅ Remote description set. Processing ${this.pendingCandidates.length} pending ICE candidates...`);
      
      for (const candidate of this.pendingCandidates) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (candidateErr) {
          console.warn('⚠️ Failed to add pending ICE candidate:', candidateErr);
        }
      }
      this.pendingCandidates = [];
    } catch (err) {
      console.error('❌ Failed to handle offer:', err);
      throw err;
    }
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    try {
      console.log('📤 Creating answer...');
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      console.log('✅ Answer created and set as local description');
      return answer;
    } catch (err) {
      console.error('❌ Failed to create answer:', err);
      throw err;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    try {
      console.log('📥 Handling received answer...');
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      this.remoteDescriptionSet = true;
      console.log(`✅ Remote description set. Processing ${this.pendingCandidates.length} pending ICE candidates...`);
      
      for (const candidate of this.pendingCandidates) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (candidateErr) {
          console.warn('⚠️ Failed to add pending ICE candidate:', candidateErr);
        }
      }
      this.pendingCandidates = [];
    } catch (err) {
      console.error('❌ Failed to handle answer:', err);
      throw err;
    }
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    
    if (this.remoteDescriptionSet) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('✅ ICE candidate added immediately');
      } catch (err) {
        console.warn('⚠️ Failed to add ICE candidate:', err);
      }
    } else {
      console.log('⏳ Remote description not yet set, queuing ICE candidate...');
      this.pendingCandidates.push(candidate);
    }
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = enabled;
      }
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      for (const track of this.localStream.getVideoTracks()) {
        track.enabled = enabled;
      }
    }
  }

  async replaceVideoTrack(screenStream: MediaStream): Promise<void> {
    if (!this.pc) return;
    const videoTrack = screenStream.getVideoTracks()[0];
    if (videoTrack) {
      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(videoTrack);
      }
    }
  }

  async restoreVideoTrack(): Promise<void> {
    if (!this.pc || !this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(videoTrack);
      }
    }
  }

  close(): void {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;
  }

  get isCaller(): boolean {
    return this.isInitiator;
  }
}
