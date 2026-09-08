export interface WebRTCConfig {
  onRemoteStream: (stream: MediaStream) => void;
  onLocalStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onSignal: (type: 'offer' | 'answer' | 'ice-candidate', data: unknown) => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
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

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.config.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.config.onRemoteStream(this.remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.config.onSignal('ice-candidate', event.candidate.toJSON());
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
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(offer);
    this.remoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      await this.pc.addIceCandidate(candidate);
    }
    this.pendingCandidates = [];
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(answer);
    this.remoteDescriptionSet = true;
    for (const candidate of this.pendingCandidates) {
      await this.pc.addIceCandidate(candidate);
    }
    this.pendingCandidates = [];
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    if (this.remoteDescriptionSet) {
      await this.pc.addIceCandidate(candidate);
    } else {
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
