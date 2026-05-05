-- Migration: Cleanup-Funktion für verwaiste classifier_prompts
-- Indexes werden in Task 11 hinzugefügt

-- ─── Verwaiste classifier_prompts löschen ─────────────────────────────────
-- Referenziert von keinem classification_run mehr
CREATE OR REPLACE FUNCTION cleanup_orphaned_prompts()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM classifier_prompts
  WHERE hash NOT IN (
    SELECT DISTINCT prompt_hash
    FROM classification_runs
    WHERE prompt_hash IS NOT NULL
  );
$$;

-- Paginierte Review-Queries: Status-Filter + Sortierung nach Erstellungsdatum
CREATE INDEX IF NOT EXISTS incoming_items_status_created_idx
  ON incoming_items(status, created_at DESC);

-- Batch-Klassifizierung: Filter nach processing_state
CREATE INDEX IF NOT EXISTS incoming_items_processing_state_idx
  ON incoming_items(processing_state);

-- JOIN-Performance fuer RSS-Feed-Zuordnung
CREATE INDEX IF NOT EXISTS incoming_items_feed_id_idx
  ON incoming_items(feed_id);
