// ============================================================
// FIX 1: Update ICE Servers in webrtc.ts
// ============================================================
// CURRENT (FAILING):
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// REPLACE WITH:
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
  {
    urls: 'turn:turnserver.open-xchange.com:443?transport=tcp',
  },
];


// ============================================================
// FIX 2: Add Logging to webrtc.ts init()
// ============================================================
// ADD after line 31:
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
  
async getLocalStream(withVideo: boolean): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: true,
    video: withVideo ? { facingMode: 'user', width: 1280, height: 720 } : false,
  };

  try {
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // NEW: Check if we actually got video
    if (withVideo) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length === 0) {
        console.error('❌ CRITICAL: Camera permission was DENIED. Check browser permissions.');
        throw new Error('Camera access denied - check browser permissions');
      }
    }
    
  } catch (err) {
    console.error('❌ Camera error:', err);
    // Don't silently fall back - throw the error
    throw err; // <-- CHANGE: Was swallowing the error
  }

  this.config.onLocalStream(this.localStream);
  return this.localStream;
}
  this.pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('🧊 ICE candidate found:', event.candidate.candidate);
      this.config.onSignal('ice-candidate', event.candidate.toJSON());
    } else {
      console.log('✅ ICE gathering complete');
    }
  };

  // ... rest of init
}


// ============================================================
// FIX 3: Add Error Handling to getLocalStream()
// ============================================================
// REPLACE the entire method in webrtc.ts:
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


// ============================================================
// FIX 4: Improve Offer/Answer Handling
// ============================================================
// UPDATE in webrtc.ts:
async createOffer(): Promise<RTCSessionDescriptionInit> {
  if (!this.pc) throw new Error('PeerConnection not initialized');
  console.log('📤 Creating offer...');
  const offer = await this.pc.createOffer({ 
    offerToReceiveAudio: true, 
    offerToReceiveVideo: true 
  });
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


// ============================================================
// FIX 5: Add Connection Monitoring in ChatRoom.tsx
// ============================================================
// ADD this useEffect after the WebRTC setup (around line 183):

useEffect(() => {
  if (!isMediaMode) return;

  // Monitor connection state with timeout
  const connectionTimeout = setTimeout(() => {
    if (connState !== 'connected' && connState !== 'completed') {
      console.warn(`⚠️ WebRTC connection stuck in state: ${connState}`);
      console.log('Possible causes:');
      console.log('1. STUN/TURN server issues');
      console.log('2. Firewall blocking WebRTC');
      console.log('3. Supabase signals not being relayed');
      console.log('4. Camera permission denied');
    }
  }, 15000); // 15 second timeout

  return () => clearTimeout(connectionTimeout);
}, [connState, isMediaMode]);


// ============================================================
// FIX 6: Improve Signal Processing in ChatRoom.tsx
// ============================================================
// REPLACE the signal subscription (lines 186-210):

// Subscribe to incoming signals
const channel = supabase
  .channel(`webrtc:${session.id}`)
  .on(
    'postgres_changes',
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'webrtc_signals', 
      filter: `receiver_id=eq.${guestId}` 
    },
    async (payload) => {
      const signal = payload.new as { 
        id: string; 
        type: string; 
        data: Record<string, unknown>; 
        sender_id: string 
      };

      try {
        console.log(`📡 Received WebRTC signal type: ${signal.type}`);

        if (signal.type === 'offer') {
          console.log('📥 Processing offer from caller...');
          await manager.handleOffer(signal.data as unknown as RTCSessionDescriptionInit);
          const answer = await manager.createAnswer();
          await supabase.from('webrtc_signals').insert({
            session_id: session.id,
            sender_id: guestId,
            receiver_id: strangerId,
            type: 'answer',
            data: answer as unknown as Record<string, unknown>,
          });
          console.log('📤 Answer sent back to caller');
        } else if (signal.type === 'answer') {
          console.log('📥 Processing answer from responder...');
          await manager.handleAnswer(signal.data as unknown as RTCSessionDescriptionInit);
          console.log('✅ Answer processed, waiting for ICE candidates...');
        } else if (signal.type === 'ice-candidate') {
          console.log('🧊 Processing ICE candidate...');
          await manager.handleIceCandidate(signal.data as unknown as RTCIceCandidateInit);
        }

        // Clean up consumed signal (with small delay to ensure processing)
        setTimeout(async () => {
          await supabase.from('webrtc_signals').delete().eq('id', signal.id);
        }, 500);
      } catch (err) {
        console.error(`❌ Error processing signal (${signal.type}):`, err);
      }
    }
  )
  .subscribe();


// ============================================================
// FIX 7: Add State Inspection Tool
// ============================================================
// ADD after the ChatRoom component setup:

// Make debugging easier in browser console
useEffect(() => {
  if (typeof window !== 'undefined') {
    (window as any).__debugRandomlyChat = {
      connState,
      micOn,
      camOn,
      screenSharing,
      localVideoRef: localVideoRef.current,
      remoteVideoRef: remoteVideoRef.current,
      webrtcManager: webrtcRef.current,
      testCamera: async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: 'user' }
          });
          console.log('✅ Camera test successful');
          stream.getTracks().forEach(t => t.stop());
        } catch (err) {
          console.error('❌ Camera test failed:', err);
        }
      },
    };
  }
}, [connState, micOn, camOn, screenSharing]);

// Usage in browser console:
// __debugRandomlyChat.testCamera() // Test camera access
// __debugRandomlyChat.connState // Check current connection state
// __debugRandomlyChat.webrtcManager // Inspect WebRTC manager


// ============================================================
// TESTING CHECKLIST
// ============================================================
/*
1. Check browser console for log messages:
   ✅ "Media stream acquired" - camera working
   ✅ "Connection state changed: connected" - P2P connected
   ✅ "Remote track received: video" - video streaming
   
2. If you see "Connection state changed: failed":
   → TURN servers not working
   → Add better TURN servers (see FIX 1)
   
3. If you see "Media stream acquired: video: 0":
   → Camera permission was denied or no camera
   → Check browser camera permissions
   
4. If "Remote track received" never appears:
   → Remote peer's camera not captured
   → Signaling not working
   → Check Supabase webrtc_signals table
   
5. Test with another device on same network:
   → Rules out NAT/firewall as main issue
   → Helps identify if it's network-specific
*/
