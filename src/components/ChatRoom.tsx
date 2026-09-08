import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Send, SkipForward, Flag, Mic, MicOff, Video, VideoOff,
  MonitorUp, PhoneOff, Check, CheckCheck, Loader2, Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { WebRTCManager } from '@/lib/webrtc';
import { filterProfanity, detectNSFW } from '@/lib/profanity';
import type { Message, ChatSession, ChatMode } from '@/lib/types';
import ReportModal from './ReportModal';

interface ChatRoomProps {
  session: ChatSession;
  guestId: string;
  nickname: string;
  onSkip: () => void;
  onEnd: () => void;
}

export default function ChatRoom({ session, guestId, nickname, onSkip, onEnd }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [connState, setConnState] = useState<RTCPeerConnectionState>('new');
  const [strangerLeft, setStrangerLeft] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoMobileRef = useRef<HTMLVideoElement>(null);
  const localVideoDesktopRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitRef = useRef(false);
  const isCaller = session.user_a === guestId;
  const strangerId = session.user_a === guestId ? session.user_b : session.user_a;

  const isVideoMode = session.mode === 'video';
  const isVoiceMode = session.mode === 'voice';
  const isMediaMode = isVideoMode || isVoiceMode;

  // Load existing messages
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

      if (data) setMessages(data as Message[]);
    };
    loadMessages();
  }, [session.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Subscribe to messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${session.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${session.id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));

          // Mark as read if from stranger
          if (newMsg.sender_id !== guestId && !newMsg.read) {
            supabase.from('messages').update({ read: true }).eq('id', newMsg.id).then();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `session_id=eq.${session.id}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session.id, guestId]);

  // Subscribe to typing status
  useEffect(() => {
    const channel = supabase
      .channel(`typing:${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'typing_status', filter: `session_id=eq.${session.id}` },
        (payload) => {
          const row = payload.new as { guest_id: string; is_typing: boolean };
          if (row.guest_id !== guestId) {
            setStrangerTyping(row.is_typing);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session.id, guestId]);

  // Subscribe to session status (stranger left)
  useEffect(() => {
    const channel = supabase
      .channel(`session:${session.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_sessions', filter: `id=eq.${session.id}` },
        (payload) => {
          const updated = payload.new as ChatSession;
          if (updated.status === 'ended' && updated.ended_by !== guestId) {
            setStrangerLeft(true);
            webrtcRef.current?.close();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session.id, guestId]);

  // WebRTC signaling
  useEffect(() => {
    if (!isMediaMode || hasInitRef.current) return;
    hasInitRef.current = true;

    const manager = new WebRTCManager({
      onRemoteStream: (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onLocalStream: (stream) => {
        console.log('📹 Setting local stream to both video elements');
        if (localVideoMobileRef.current) {
          localVideoMobileRef.current.srcObject = stream;
        }
        if (localVideoDesktopRef.current) {
          localVideoDesktopRef.current.srcObject = stream;
        }
      },
      onConnectionStateChange: (state) => {
        setConnState(state);
      },
      onSignal: async (type, data) => {
        await supabase.from('webrtc_signals').insert({
          session_id: session.id,
          sender_id: guestId,
          receiver_id: strangerId,
          type,
          data,
        });
      },
    });

    webrtcRef.current = manager;

    (async () => {
      try {
        await manager.getLocalStream(isVideoMode);
        await manager.init(isCaller);

        if (isCaller) {
          const offer = await manager.createOffer();
          await supabase.from('webrtc_signals').insert({
            session_id: session.id,
            sender_id: guestId,
            receiver_id: strangerId,
            type: 'offer',
            data: offer,
          });
        }
      } catch (err) {
        console.error('WebRTC init error:', err);
      }
    })();

    // Subscribe to incoming signals
    const channel = supabase
      .channel(`webrtc:${session.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webrtc_signals', filter: `receiver_id=eq.${guestId}` },
        async (payload) => {
          const signal = payload.new as { id: string; type: string; data: Record<string, unknown>; sender_id: string };
          if (signal.type === 'offer') {
            await manager.handleOffer(signal.data as unknown as RTCSessionDescriptionInit);
            const answer = await manager.createAnswer();
            await supabase.from('webrtc_signals').insert({
              session_id: session.id,
              sender_id: guestId,
              receiver_id: strangerId,
              type: 'answer',
              data: answer as unknown as Record<string, unknown>,
            });
          } else if (signal.type === 'answer') {
            await manager.handleAnswer(signal.data as unknown as RTCSessionDescriptionInit);
          } else if (signal.type === 'ice-candidate') {
            await manager.handleIceCandidate(signal.data as unknown as RTCIceCandidateInit);
          }
          // Clean up consumed signal
          await supabase.from('webrtc_signals').delete().eq('id', signal.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      manager.close();
    };
  }, [isMediaMode, isVideoMode, isCaller, session.id, guestId, strangerId]);

  // Update typing status
  const updateTypingStatus = useCallback((typing: boolean) => {
    supabase.from('typing_status').upsert({
      session_id: session.id,
      guest_id: guestId,
      is_typing: typing,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id,guest_id' }).then();
  }, [session.id, guestId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 2000);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    setInput('');
    setIsTyping(false);
    updateTypingStatus(false);

    const filtered = filterProfanity(text);
    const nsfw = detectNSFW(text);

    await supabase.from('messages').insert({
      session_id: session.id,
      sender_id: guestId,
      content: filtered,
      type: 'text',
      read: false,
    });

    if (nsfw) {
      await supabase.from('messages').insert({
        session_id: session.id,
        sender_id: 'system',
        content: 'Warning: This conversation contains content flagged by our automated moderation system.',
        type: 'system',
        read: false,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    webrtcRef.current?.toggleAudio(next);
  };

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    webrtcRef.current?.toggleVideo(next);
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      await webrtcRef.current?.restoreVideoTrack();
      setScreenSharing(false);
    } else {
      try {
        const screenStream = await webrtcRef.current?.getDisplayStream();
        if (screenStream) {
          await webrtcRef.current?.replaceVideoTrack(screenStream);
          setScreenSharing(true);
          screenStream.getVideoTracks()[0].onended = () => {
            webrtcRef.current?.restoreVideoTrack();
            setScreenSharing(false);
          };
        }
      } catch (err) {
        console.error('Screen share error:', err);
      }
    }
  };

  const handleReport = async (reason: string, details: string) => {
    await supabase.from('reports').insert({
      session_id: session.id,
      reporter_id: guestId,
      reported_id: strangerId,
      reason,
      details: details || null,
      status: 'pending',
    });
  };

  if (strangerLeft) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-gray-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Stranger Disconnected</h2>
          <p className="text-gray-400 mb-6">Your chat partner has left the conversation.</p>
          <button
            onClick={onSkip}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold rounded-xl hover:from-teal-400 hover:to-cyan-500 transition-all shadow-lg shadow-teal-500/20"
          >
            <SkipForward className="w-5 h-5" />
            Find New Stranger
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 bg-gray-900/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                connState === 'connected' ? 'bg-green-500' :
                connState === 'connecting' || connState === 'new' ? 'bg-amber-500 animate-pulse' :
                'bg-gray-600'
              }`} />
              <span className="text-white font-medium text-sm">
                {session.mode === 'text' && !isMediaMode ? 'Connected' :
                 connState === 'connected' ? 'Connected' :
                 connState === 'connecting' ? 'Connecting...' :
                 connState === 'new' ? 'Initializing...' :
                 connState === 'disconnected' ? 'Reconnecting...' :
                 connState === 'failed' ? 'Connection failed' :
                 'Connected'}
              </span>
            </div>
            {session.interests_matched && session.interests_matched.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 ml-2">
                {session.interests_matched.slice(0, 3).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-teal-500/20 border border-teal-500/30 text-teal-300 rounded text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReportOpen(true)}
              className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              title="Report user"
            >
              <Flag className="w-5 h-5" />
            </button>
            <button
              onClick={onEnd}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="End chat"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
        {/* Video/Voice area */}
        {isMediaMode && (
          <div className="flex-shrink-0 lg:w-1/2 flex flex-col gap-3 relative">
            <div className="relative aspect-[4/3] sm:aspect-video bg-gray-900 rounded-xl overflow-hidden border border-white/10 w-full max-h-[50vh] sm:max-h-none">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {connState !== 'connected' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Waiting for stranger's {isVideoMode ? 'video' : 'audio'}...</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-white text-xs z-20">
                Stranger
              </div>
              
              {/* Floating local video on mobile, bottom right inside remote video */}
              <div className="absolute bottom-2 right-2 w-24 aspect-[3/4] sm:aspect-video sm:w-32 lg:hidden bg-gray-900 rounded-xl overflow-hidden border border-white/20 shadow-xl z-30">
                <video
                  ref={localVideoMobileRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-white text-[10px] sm:text-xs">
                  You
                </div>
              </div>
            </div>

            {/* Inline local video on desktop */}
            <div className="hidden lg:block relative aspect-video bg-gray-900 rounded-xl overflow-hidden border border-white/10 w-full">
              <video
                ref={localVideoDesktopRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-white text-xs">
                You
              </div>
            </div>

            {/* Media controls */}
            <div className="flex items-center justify-center gap-2 py-2">
              <ControlButton
                active={micOn}
                activeIcon={<Mic className="w-5 h-5" />}
                inactiveIcon={<MicOff className="w-5 h-5" />}
                activeColor="bg-white/10 text-white hover:bg-white/20"
                inactiveColor="bg-red-500/20 text-red-400 hover:bg-red-500/30"
                onClick={toggleMic}
                label={micOn ? 'Mute' : 'Unmute'}
              />
              {isVideoMode && (
                <ControlButton
                  active={camOn}
                  activeIcon={<Video className="w-5 h-5" />}
                  inactiveIcon={<VideoOff className="w-5 h-5" />}
                  activeColor="bg-white/10 text-white hover:bg-white/20"
                  inactiveColor="bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  onClick={toggleCam}
                  label={camOn ? 'Cam Off' : 'Cam On'}
                />
              )}
              {isVideoMode && (
                <ControlButton
                  active={!screenSharing}
                  activeIcon={<MonitorUp className="w-5 h-5" />}
                  inactiveIcon={<MonitorUp className="w-5 h-5" />}
                  activeColor="bg-white/10 text-white hover:bg-white/20"
                  inactiveColor="bg-teal-500/20 text-teal-400 hover:bg-teal-500/30"
                  onClick={toggleScreenShare}
                  label={screenSharing ? 'Stop Share' : 'Share Screen'}
                />
              )}
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 flex flex-col bg-gray-900/50 border border-white/10 rounded-xl overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {/* System message */}
            <div className="text-center">
              <span className="inline-block px-3 py-1 bg-white/5 text-gray-500 text-xs rounded-full">
                You are now chatting with a random stranger. Say hi!
              </span>
            </div>

            {messages.map((msg) => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="text-center">
                    <span className="inline-block px-3 py-1 bg-amber-500/10 text-amber-400 text-xs rounded-full border border-amber-500/20">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              const isMine = msg.sender_id === guestId;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
                        isMine
                          ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-br-md'
                          : 'bg-white/10 text-gray-100 rounded-bl-md'
                      }`}
                    >
                      {msg.content}
                    </div>
                    {isMine && (
                      <div className="flex items-center gap-1 mt-1 mr-1">
                        {msg.read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-teal-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-gray-500" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {strangerTyping && (
              <div className="flex justify-start">
                <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 p-2 sm:p-3 border-t border-white/10 bg-gray-900">
            <div className="flex items-center gap-2">
              <button
                onClick={onSkip}
                className="px-4 py-2 sm:py-3 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 hover:text-white transition-colors text-sm font-bold whitespace-nowrap"
              >
                <span className="hidden sm:inline">Stop / Next</span>
                <span className="sm:hidden">Stop</span>
              </button>
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                maxLength={500}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 transition-colors text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="p-2 sm:p-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl hover:from-teal-400 hover:to-cyan-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {reportOpen && (
        <ReportModal
          reportedId={strangerId}
          onSubmit={handleReport}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

function ControlButton({
  active,
  activeIcon,
  inactiveIcon,
  activeColor,
  inactiveColor,
  onClick,
  label,
}: {
  active: boolean;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  activeColor: string;
  inactiveColor: string;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-3 rounded-xl transition-colors ${active ? activeColor : inactiveColor}`}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  );
}
