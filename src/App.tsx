import { useState, useEffect, useRef, useCallback } from 'react';
import AgeGate from '@/components/AgeGate';
import Lobby from '@/components/Lobby';
import Searching from '@/components/Searching';
import ChatRoom from '@/components/ChatRoom';
import ChatEnded from '@/components/ChatEnded';
import { getGuestId, getNickname, setNickname as saveNickname, clearGuestId } from '@/lib/guest';
import {
  joinWaitingRoom,
  tryMatch,
  getMyMatchedEntry,
  getSession,
  leaveWaitingRoom,
  endSession,
  cleanupStaleWaiting,
} from '@/lib/matchmaking';
import { supabase } from '@/lib/supabase';
import type { Screen, ChatMode, ChatSession } from '@/lib/types';

interface ChatConfig {
  interests: string[];
  language: string;
  mode: ChatMode;
  nickname: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('age-gate');
  const [guestId] = useState(() => getGuestId());
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [estimatedWait, setEstimatedWait] = useState(15);
  const [endReason, setEndReason] = useState('Your chat has ended.');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    cleanupStaleWaiting().then();
  }, []);

  const handleAgeConfirm = useCallback(() => {
    setScreen('lobby');
  }, []);

  const handleStartChat = useCallback((config: ChatConfig) => {
    setChatConfig(config);
    if (config.nickname) saveNickname(config.nickname);
    setScreen('searching');
    setEstimatedWait(15 + Math.floor(Math.random() * 10));

    (async () => {
      await leaveWaitingRoom(guestId);
      await joinWaitingRoom(guestId, config.nickname || null, config.interests, config.language, config.mode);

      // Try to match immediately
      const sessionId = await tryMatch(guestId, config.interests, config.language, config.mode);

      if (sessionId) {
        const s = await getSession(sessionId);
        if (s) {
          setSession(s);
          setScreen('chat');
          return;
        }
      }

      // If no immediate match, poll for match via realtime subscription
      const channel = supabase
        .channel(`waiting:${guestId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'waiting_room', filter: `guest_id=eq.${guestId}` },
          async (payload) => {
            const row = payload.new as { status: string; session_id: string | null };
            if (row.status === 'matched' && row.session_id) {
              supabase.removeChannel(channel);
              const s = await getSession(row.session_id);
              if (s) {
                setSession(s);
                setScreen('chat');
              }
            }
          }
        )
        .subscribe();

      // Also poll as fallback
      matchCheckRef.current = setInterval(async () => {
        const matched = await getMyMatchedEntry(guestId);
        if (matched?.session_id) {
          if (matchCheckRef.current) clearInterval(matchCheckRef.current);
          const s = await getSession(matched.session_id);
          if (s) {
            setSession(s);
            setScreen('chat');
          }
        }
      }, 2000);
    })();
  }, [guestId]);

  const handleCancelSearch = useCallback(async () => {
    if (matchCheckRef.current) clearInterval(matchCheckRef.current);
    await leaveWaitingRoom(guestId);
    setScreen('lobby');
  }, [guestId]);

  const handleSkip = useCallback(async () => {
    if (!session || !chatConfig) return;

    // End current session
    await endSession(session.id, guestId);
    setSession(null);
    setScreen('searching');
    setEstimatedWait(10 + Math.floor(Math.random() * 8));

    // Start new search
    await leaveWaitingRoom(guestId);
    await joinWaitingRoom(guestId, chatConfig.nickname || null, chatConfig.interests, chatConfig.language, chatConfig.mode);

    const sessionId = await tryMatch(guestId, chatConfig.interests, chatConfig.language, chatConfig.mode);

    if (sessionId) {
      const s = await getSession(sessionId);
      if (s) {
        setSession(s);
        setScreen('chat');
        return;
      }
    }

    // Subscribe for match
    const channel = supabase
      .channel(`waiting-skip:${guestId}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'waiting_room', filter: `guest_id=eq.${guestId}` },
        async (payload) => {
          const row = payload.new as { status: string; session_id: string | null };
          if (row.status === 'matched' && row.session_id) {
            supabase.removeChannel(channel);
            const s = await getSession(row.session_id);
            if (s) {
              setSession(s);
              setScreen('chat');
            }
          }
        }
      )
      .subscribe();

    matchCheckRef.current = setInterval(async () => {
      const matched = await getMyMatchedEntry(guestId);
      if (matched?.session_id) {
        if (matchCheckRef.current) clearInterval(matchCheckRef.current);
        const s = await getSession(matched.session_id);
        if (s) {
          setSession(s);
          setScreen('chat');
        }
      }
    }, 2000);
  }, [session, chatConfig, guestId]);

  const handleEnd = useCallback(async () => {
    if (session) {
      await endSession(session.id, guestId);
    }
    setSession(null);
    setEndReason('You ended the chat.');
    setScreen('ended');
  }, [session, guestId]);

  const handleNewChat = useCallback(() => {
    setSession(null);
    setEndReason('');
    if (chatConfig) {
      handleStartChat(chatConfig);
    } else {
      setScreen('lobby');
    }
  }, [chatConfig, handleStartChat]);

  const handleHome = useCallback(() => {
    setSession(null);
    setChatConfig(null);
    setScreen('lobby');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (matchCheckRef.current) clearInterval(matchCheckRef.current);
    };
  }, []);

  const currentNickname = chatConfig?.nickname || getNickname() || guestId;

  return (
    <>
      {screen === 'age-gate' && <AgeGate onConfirm={handleAgeConfirm} />}
      {screen === 'lobby' && <Lobby onStart={handleStartChat} guestId={guestId} />}
      {screen === 'searching' && chatConfig && (
        <Searching
          mode={chatConfig.mode}
          interests={chatConfig.interests}
          language={chatConfig.language}
          onCancel={handleCancelSearch}
          estimatedWait={estimatedWait}
        />
      )}
      {screen === 'chat' && session && (
        <ChatRoom
          session={session}
          guestId={guestId}
          nickname={currentNickname}
          onSkip={handleSkip}
          onEnd={handleEnd}
        />
      )}
      {screen === 'ended' && (
        <ChatEnded
          reason={endReason}
          onNewChat={handleNewChat}
          onHome={handleHome}
        />
      )}
    </>
  );
}
