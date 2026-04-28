-- Migration: Junction-Tabelle für KI-/manuelle Topic-Zuordnungen mit Konfidenz

CREATE TABLE IF NOT EXISTS incoming_item_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_item_id uuid NOT NULL REFERENCES incoming_items(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  rank int NOT NULL DEFAULT 1,
  confidence numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  is_primary boolean NOT NULL DEFAULT false,
  reason text,
  source text NOT NULL CHECK (source IN ('llm','manual')),
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','confirmed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iit_item_idx ON incoming_item_topics(incoming_item_id);
CREATE INDEX IF NOT EXISTS iit_topic_idx ON incoming_item_topics(topic_id);
CREATE INDEX IF NOT EXISTS iit_status_idx ON incoming_item_topics(status);

-- Nur eine primary-Zuordnung pro Item
CREATE UNIQUE INDEX IF NOT EXISTS iit_one_primary_per_item
  ON incoming_item_topics(incoming_item_id)
  WHERE is_primary = true;

-- Verhindern, dass dasselbe Topic doppelt für ein Item zugeordnet wird
CREATE UNIQUE INDEX IF NOT EXISTS iit_unique_item_topic
  ON incoming_item_topics(incoming_item_id, topic_id);
