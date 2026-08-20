-- We-Rise Community Phase 1
-- Adds persistent comments and one-support-per-device reactions.

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
