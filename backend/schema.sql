CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  goal REAL NOT NULL,
  raised REAL DEFAULT 0,
  backers INTEGER DEFAULT 0,
  creator TEXT DEFAULT 'Anonymous We-Rise Lady',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  donor TEXT DEFAULT 'Anonymous',
  amount REAL NOT NULL,
  date TEXT DEFAULT (date('now')),
  time TEXT DEFAULT (time('now')),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS community_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK(length(title) <= 250),
  author TEXT DEFAULT 'Anonymous We-Rise Lady',
  replies INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS community_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  author TEXT DEFAULT 'Anonymous We-Rise Lady',
  content TEXT NOT NULL CHECK(length(content) <= 250),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (topic_id) REFERENCES community_topics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_supports (
  topic_id INTEGER NOT NULL,
  supporter_key TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (topic_id, supporter_key),
  FOREIGN KEY (topic_id) REFERENCES community_topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_comments_topic_id
ON community_comments(topic_id, created_at);

CREATE INDEX IF NOT EXISTS idx_community_supports_topic_id
ON community_supports(topic_id);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer TEXT NOT NULL,
  referred_email TEXT,
  commission REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

-- We-Rise Phase 2 direct messaging
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
