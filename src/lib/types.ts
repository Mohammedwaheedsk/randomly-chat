export type ChatMode = 'text' | 'video' | 'voice';

export type Screen = 'age-gate' | 'lobby' | 'searching' | 'chat' | 'ended';

export interface WaitingRoomEntry {
  id: string;
  guest_id: string;
  nickname: string | null;
  interests: string[];
  language: string;
  mode: ChatMode;
  status: 'waiting' | 'matched' | 'left';
  session_id: string | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_a: string;
  user_b: string;
  mode: ChatMode;
  status: 'active' | 'ended';
  interests_matched: string[];
  created_at: string;
  ended_at: string | null;
  ended_by: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'system' | 'image';
  read: boolean;
  created_at: string;
}

export interface WebRTCSignal {
  id: string;
  session_id: string;
  sender_id: string;
  receiver_id: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: Record<string, unknown>;
  created_at: string;
}

export interface TypingStatus {
  id: string;
  session_id: string;
  guest_id: string;
  is_typing: boolean;
  updated_at: string;
}

export interface Report {
  id: string;
  session_id: string | null;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewed' | 'actioned';
  created_at: string;
}
