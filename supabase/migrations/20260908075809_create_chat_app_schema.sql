/*
# Omegle-Style Random Chat - Database Schema

## Overview
Creates the full schema for an anonymous random chat website with matchmaking,
real-time text chat, WebRTC signaling, typing indicators, user reports, and bans.

## New Tables

### waiting_room
Tracks users currently looking for a chat partner.
- guest_id: anonymous identifier like "Stranger_4821"
- nickname: optional user-chosen name
- interests: array of interest tags for matching
- language: preferred language code
- mode: 'text', 'video', or 'voice'
- status: 'waiting', 'matched', or 'left'
- session_id: links to chat_sessions once matched

### chat_sessions
Represents a 1-on-1 chat session between two strangers.
- user_a / user_b: guest IDs of both participants
- mode: chat mode (text/video/voice)
- status: 'active' or 'ended'
- interests_matched: shared interests that brought them together
- ended_by: guest ID of who ended the session

### messages
Individual chat messages within a session.
- session_id: FK to chat_sessions
- sender_id: guest ID of sender
- content: message text
- type: 'text', 'system', or 'image'
- read: read receipt flag

### webrtc_signals
WebRTC signaling data (SDP offers/answers, ICE candidates) relayed through Supabase.
- session_id: FK to chat_sessions
- sender_id / receiver_id: guest IDs
- type: 'offer', 'answer', or 'ice-candidate'
- data: JSON signaling payload

### typing_status
Tracks whether a user is currently typing in a session.
- session_id: FK to chat_sessions
- guest_id: user's guest ID
- is_typing: boolean flag
- Unique constraint on (session_id, guest_id)

### reports
User-submitted reports for moderation.
- reporter_id / reported_id: guest IDs
- reason: short reason category
- details: optional longer description
- status: 'pending', 'reviewed', or 'actioned'

### bans
Banned users by guest ID or IP hash.
- guest_id: anonymous ID
- ip_hash: hashed IP address
- banned_until: expiry timestamp (null = permanent)

## Security
- RLS enabled on all tables.
- All policies use `TO anon, authenticated` since this is a no-signup anonymous app.
- All data is intentionally shared between chat participants.

## Functions
- try_match(): atomically finds a compatible waiting stranger and creates a session
- cleanup_stale_waiting(): removes waiting room entries older than 5 minutes
*/

-- ============================================================
-- waiting_room
-- ============================================================
CREATE TABLE IF NOT EXISTS waiting_room (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text NOT NULL,
  nickname text,
  interests text[] DEFAULT '{}',
  language text DEFAULT 'en',
  mode text NOT NULL DEFAULT 'text',
  status text NOT NULL DEFAULT 'waiting',
  session_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waiting_room_status_mode ON waiting_room(status, mode);
CREATE INDEX IF NOT EXISTS idx_waiting_room_guest_id ON waiting_room(guest_id);
CREATE INDEX IF NOT EXISTS idx_waiting_room_created_at ON waiting_room(created_at);

ALTER TABLE waiting_room ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_waiting_room" ON waiting_room;
CREATE POLICY "anon_select_waiting_room" ON waiting_room FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_waiting_room" ON waiting_room;
CREATE POLICY "anon_insert_waiting_room" ON waiting_room FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_waiting_room" ON waiting_room;
CREATE POLICY "anon_update_waiting_room" ON waiting_room FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_waiting_room" ON waiting_room;
CREATE POLICY "anon_delete_waiting_room" ON waiting_room FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- chat_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a text NOT NULL,
  user_b text NOT NULL,
  mode text NOT NULL DEFAULT 'text',
  status text NOT NULL DEFAULT 'active',
  interests_matched text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  ended_by text
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_a ON chat_sessions(user_a);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_b ON chat_sessions(user_b);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_chat_sessions" ON chat_sessions;
CREATE POLICY "anon_select_chat_sessions" ON chat_sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_chat_sessions" ON chat_sessions;
CREATE POLICY "anon_insert_chat_sessions" ON chat_sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_chat_sessions" ON chat_sessions;
CREATE POLICY "anon_update_chat_sessions" ON chat_sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_chat_sessions" ON chat_sessions;
CREATE POLICY "anon_delete_chat_sessions" ON chat_sessions FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_messages" ON messages;
CREATE POLICY "anon_select_messages" ON messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
CREATE POLICY "anon_insert_messages" ON messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_messages" ON messages;
CREATE POLICY "anon_update_messages" ON messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_messages" ON messages;
CREATE POLICY "anon_delete_messages" ON messages FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- webrtc_signals
-- ============================================================
CREATE TABLE IF NOT EXISTS webrtc_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  receiver_id text NOT NULL,
  type text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webrtc_signals_session ON webrtc_signals(session_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_receiver ON webrtc_signals(receiver_id);

ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_webrtc_signals" ON webrtc_signals;
CREATE POLICY "anon_select_webrtc_signals" ON webrtc_signals FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_webrtc_signals" ON webrtc_signals;
CREATE POLICY "anon_insert_webrtc_signals" ON webrtc_signals FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_webrtc_signals" ON webrtc_signals;
CREATE POLICY "anon_delete_webrtc_signals" ON webrtc_signals FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- typing_status
-- ============================================================
CREATE TABLE IF NOT EXISTS typing_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  guest_id text NOT NULL,
  is_typing boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_status_session ON typing_status(session_id);

ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_typing_status" ON typing_status;
CREATE POLICY "anon_select_typing_status" ON typing_status FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_typing_status" ON typing_status;
CREATE POLICY "anon_insert_typing_status" ON typing_status FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_typing_status" ON typing_status;
CREATE POLICY "anon_update_typing_status" ON typing_status FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_typing_status" ON typing_status;
CREATE POLICY "anon_delete_typing_status" ON typing_status FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- reports
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  reporter_id text NOT NULL,
  reported_id text NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reported_id ON reports(reported_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports" ON reports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports" ON reports FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- bans
-- ============================================================
CREATE TABLE IF NOT EXISTS bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id text,
  ip_hash text,
  reason text NOT NULL,
  banned_until timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bans_guest_id ON bans(guest_id);
CREATE INDEX IF NOT EXISTS idx_bans_ip_hash ON bans(ip_hash);

ALTER TABLE bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bans" ON bans;
CREATE POLICY "anon_select_bans" ON bans FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bans" ON bans;
CREATE POLICY "anon_insert_bans" ON bans FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ============================================================
-- try_match function - atomic matchmaking
-- ============================================================
CREATE OR REPLACE FUNCTION try_match(
  p_guest_id text,
  p_interests text[],
  p_language text,
  p_mode text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  matched_row waiting_room%ROWTYPE;
  new_session_id uuid;
  shared_interests text[];
BEGIN
  -- Find a compatible waiting user (not yourself, same mode, matching language)
  SELECT * INTO matched_row
  FROM waiting_room
  WHERE status = 'waiting'
    AND guest_id != p_guest_id
    AND mode = p_mode
    AND (p_language IS NULL OR language = p_language OR language IS NULL)
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF matched_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Compute shared interests
  SELECT COALESCE(array_agg(elem) FILTER (WHERE elem IS NOT NULL), '{}'::text[])
  INTO shared_interests
  FROM (
    SELECT unnest(p_interests) AS elem
    INTERSECT
    SELECT unnest(matched_row.interests)
  ) t;

  -- Create a new chat session
  INSERT INTO chat_sessions (user_a, user_b, mode, interests_matched)
  VALUES (p_guest_id, matched_row.guest_id, p_mode, shared_interests)
  RETURNING id INTO new_session_id;

  -- Mark both waiting room entries as matched
  UPDATE waiting_room SET status = 'matched', session_id = new_session_id
  WHERE id = matched_row.id;

  UPDATE waiting_room SET status = 'matched', session_id = new_session_id
  WHERE guest_id = p_guest_id AND status = 'waiting';

  RETURN new_session_id;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION try_match(text, text[], text, text) TO anon, authenticated;

-- ============================================================
-- cleanup_stale_waiting function - removes old waiting room entries
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_stale_waiting()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM waiting_room
  WHERE status = 'waiting' AND created_at < now() - interval '5 minutes';
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stale_waiting() TO anon, authenticated;

-- ============================================================
-- Enable realtime for all tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE waiting_room;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE webrtc_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_status;
