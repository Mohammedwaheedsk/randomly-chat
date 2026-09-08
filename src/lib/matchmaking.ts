import { supabase } from './supabase';
import type { ChatSession, ChatMode } from './types';

export interface MatchResult {
  session: ChatSession;
  isCaller: boolean;
}

export async function joinWaitingRoom(
  guestId: string,
  nickname: string | null,
  interests: string[],
  language: string,
  mode: ChatMode
): Promise<void> {
  await supabase.from('waiting_room').insert({
    guest_id: guestId,
    nickname: nickname || null,
    interests: interests.length > 0 ? interests : '{}',
    language,
    mode,
    status: 'waiting',
  });
}

export async function tryMatch(
  guestId: string,
  interests: string[],
  language: string,
  mode: ChatMode
): Promise<string | null> {
  const { data, error } = await supabase.rpc('try_match', {
    p_guest_id: guestId,
    p_interests: interests,
    p_language: language,
    p_mode: mode,
  });

  if (error) {
    console.error('Match error:', error);
    return null;
  }

  return data as string | null;
}

export async function getMyWaitingEntry(guestId: string) {
  const { data, error } = await supabase
    .from('waiting_room')
    .select('*')
    .eq('guest_id', guestId)
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching waiting entry:', error);
    return null;
  }

  return data;
}

export async function getMyMatchedEntry(guestId: string) {
  const { data, error } = await supabase
    .from('waiting_room')
    .select('*')
    .eq('guest_id', guestId)
    .eq('status', 'matched')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching matched entry:', error);
    return null;
  }

  return data;
}

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching session:', error);
    return null;
  }

  return data as ChatSession | null;
}

export async function leaveWaitingRoom(guestId: string): Promise<void> {
  await supabase
    .from('waiting_room')
    .delete()
    .eq('guest_id', guestId);
}

export async function endSession(
  sessionId: string,
  guestId: string
): Promise<void> {
  await supabase
    .from('chat_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString(), ended_by: guestId })
    .eq('id', sessionId);
}

export async function cleanupStaleWaiting(): Promise<void> {
  await supabase.rpc('cleanup_stale_waiting');
}
