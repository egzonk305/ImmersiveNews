-- Migration: incoming_items um content, published_at, processing_state, processing_error, updated_at, feed_id erweitern

ALTER TABLE incoming_items
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS feed_id uuid REFERENCES rss_feeds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processing_state text NOT NULL DEFAULT 'pending'
    CHECK (processing_state IN ('pending','processing','classified','failed','done')),
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- updated_at-Trigger (set_updated_at-Funktion stammt aus 001)
DROP TRIGGER IF EXISTS incoming_items_set_updated_at ON incoming_items;
CREATE TRIGGER incoming_items_set_updated_at
  BEFORE UPDATE ON incoming_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- feed_id mit source_id synchronisieren, falls source_type='rss'
UPDATE incoming_items
SET feed_id = source_id
WHERE feed_id IS NULL AND source_type = 'rss' AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS incoming_items_processing_state_idx
  ON incoming_items(processing_state, created_at);
CREATE INDEX IF NOT EXISTS incoming_items_feed_id_idx ON incoming_items(feed_id);

-- Duplikatschutz auf source_url (ohne NULL-Werte zu blockieren)
CREATE UNIQUE INDEX IF NOT EXISTS incoming_items_source_url_unique
  ON incoming_items(source_url)
  WHERE source_url IS NOT NULL;
