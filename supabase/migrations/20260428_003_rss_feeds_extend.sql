-- Migration: rss_feeds um root_topic_id und start_topic_id erweitern

ALTER TABLE rss_feeds
  ADD COLUMN IF NOT EXISTS root_topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_topic_id uuid REFERENCES topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rss_feeds_root_topic_idx ON rss_feeds(root_topic_id);
CREATE INDEX IF NOT EXISTS rss_feeds_start_topic_idx ON rss_feeds(start_topic_id);
CREATE INDEX IF NOT EXISTS rss_feeds_active_fetched_idx
  ON rss_feeds(is_active, last_fetched_at)
  WHERE is_active = true;
