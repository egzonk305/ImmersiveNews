-- Migration: Prompt-Texte deduplizieren über sha256-Hash
-- Bewahrt vollen Prompt-Inhalt nur einmal in classifier_prompts; classification_runs.prompt darf NULL werden.

CREATE TABLE IF NOT EXISTS classifier_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hash text NOT NULL UNIQUE,
  content text NOT NULL,
  byte_length int GENERATED ALWAYS AS (length(content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS classifier_prompts_hash_idx
  ON classifier_prompts(hash);

ALTER TABLE classification_runs
  ADD COLUMN IF NOT EXISTS prompt_hash text;

CREATE INDEX IF NOT EXISTS classification_runs_prompt_hash_idx
  ON classification_runs(prompt_hash);

-- Bestehende Zeilen migrieren: Hash berechnen, in classifier_prompts einfügen, prompt-Spalte leeren
-- (pgcrypto bereitet sha256 via digest())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH hashed AS (
  SELECT id, prompt, encode(digest(prompt, 'sha256'), 'hex') AS h
  FROM classification_runs
  WHERE prompt IS NOT NULL
)
INSERT INTO classifier_prompts (hash, content)
SELECT DISTINCT h, prompt FROM hashed
ON CONFLICT (hash) DO NOTHING;

UPDATE classification_runs cr
SET prompt_hash = encode(digest(cr.prompt, 'sha256'), 'hex'),
    prompt = NULL
WHERE cr.prompt IS NOT NULL;

-- Prompt-Spalte beibehalten (kann jetzt NULL bleiben), aber neuer Insert-Pfad
-- soll prompt_hash setzen statt prompt. Helper-Funktion:
CREATE OR REPLACE FUNCTION upsert_classifier_prompt(p_content text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  h text;
BEGIN
  IF p_content IS NULL THEN
    RETURN NULL;
  END IF;
  h := encode(digest(p_content, 'sha256'), 'hex');
  INSERT INTO classifier_prompts (hash, content)
    VALUES (h, p_content)
    ON CONFLICT (hash) DO NOTHING;
  RETURN h;
END;
$$;
