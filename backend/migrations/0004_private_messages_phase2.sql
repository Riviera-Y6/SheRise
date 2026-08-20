-- We-Rise Community Phase 2: member directory + direct messages.
-- This migration is additive and safe to run once on an existing Phase 1 D1 database.

CREATE TABLE IF NOT EXISTS member_profiles (
  member_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'premium')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS private_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_a_key TEXT NOT NULL,
  member_b_key TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_message_at TEXT,
  CHECK(member_a_key < member_b_key),
  UNIQUE(member_a_key, member_b_key),
  FOREIGN KEY (member_a_key) REFERENCES member_profiles(member_key) ON DELETE CASCADE,
  FOREIGN KEY (member_b_key) REFERENCES member_profiles(member_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS private_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_key TEXT NOT NULL,
  receiver_key TEXT NOT NULL,
  content TEXT NOT NULL CHECK(length(content) <= 2000),
  created_at TEXT DEFAULT (datetime('now')),
  read_at TEXT,
  FOREIGN KEY (conversation_id) REFERENCES private_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_key) REFERENCES member_profiles(member_key) ON DELETE CASCADE,
  FOREIGN KEY (receiver_key) REFERENCES member_profiles(member_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_private_conversations_a
ON private_conversations(member_a_key, last_message_at);

CREATE INDEX IF NOT EXISTS idx_private_conversations_b
ON private_conversations(member_b_key, last_message_at);

CREATE INDEX IF NOT EXISTS idx_private_messages_conversation
ON private_messages(conversation_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_private_messages_unread
ON private_messages(receiver_key, read_at, conversation_id);
