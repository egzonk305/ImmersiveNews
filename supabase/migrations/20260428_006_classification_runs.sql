-- Migration: Logs aller KI-Klassifizierungs-Calls

CREATE TABLE IF NOT EXISTS classification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_item_id uuid REFERENCES incoming_items(id) ON DELETE CASCADE,
  model text,
  status text NOT NULL CHECK (status IN ('pending','success','failed','parse_error')),
  duration_ms int,
  prompt text,
  raw_response text,
  parsed_response jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cr_item_created_idx
  ON classification_runs(incoming_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cr_created_idx
  ON classification_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS cr_status_idx ON classification_runs(status);
