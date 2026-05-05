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
