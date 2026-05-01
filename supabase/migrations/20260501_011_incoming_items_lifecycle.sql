-- Migration: Lifecycle und Enrichment auf incoming_items
-- + Update-Diff via content_hash, last_updated_from_source_at
-- + FK target_topic_id ON DELETE SET NULL

ALTER TABLE incoming_items
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'fresh'
    CHECK (lifecycle_state IN ('fresh','archived','deleted')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS enriched_content text,
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'none'
    CHECK (enrichment_status IN ('none','pending','success','failed','skipped')),
  ADD COLUMN IF NOT EXISTS enrichment_error text,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_updated_from_source_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS incoming_items_lifecycle_idx
  ON incoming_items(lifecycle_state, created_at);

CREATE INDEX IF NOT EXISTS incoming_items_lifecycle_archived_idx
  ON incoming_items(lifecycle_state, archived_at)
  WHERE lifecycle_state = 'archived';

CREATE INDEX IF NOT EXISTS incoming_items_enrichment_status_idx
  ON incoming_items(enrichment_status)
  WHERE enrichment_status IN ('pending','failed');

-- target_topic_id: bestehende FK ohne Verhalten ablösen, jetzt SET NULL beim Löschen
DO $$
DECLARE
  cn text;
BEGIN
  SELECT con.conname INTO cn
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
  WHERE rel.relname = 'incoming_items'
    AND att.attname = 'target_topic_id'
    AND con.contype = 'f'
  LIMIT 1;
  IF cn IS NOT NULL THEN
    EXECUTE format('ALTER TABLE incoming_items DROP CONSTRAINT %I', cn);
  END IF;
END$$;

ALTER TABLE incoming_items
  ADD CONSTRAINT incoming_items_target_topic_id_fkey
  FOREIGN KEY (target_topic_id) REFERENCES topics(id) ON DELETE SET NULL;

-- iit (incoming_item_topics): zusätzlicher Composite-Index
CREATE INDEX IF NOT EXISTS iit_item_status_idx
  ON incoming_item_topics(incoming_item_id, status);

CREATE INDEX IF NOT EXISTS iit_status_suggested_idx
  ON incoming_item_topics(status)
  WHERE status = 'suggested';

-- Confidence-Präzision erhöhen: 4,3 → 5,4
ALTER TABLE incoming_item_topics
  ALTER COLUMN confidence TYPE numeric(5,4);

ALTER TABLE classifier_settings
  ALTER COLUMN confidence_threshold TYPE numeric(5,4);
