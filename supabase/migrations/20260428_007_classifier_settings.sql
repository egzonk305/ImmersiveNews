-- Migration: Singleton-Tabelle für Classifier-Einstellungen

CREATE TABLE IF NOT EXISTS classifier_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ollama_base_url text NOT NULL DEFAULT 'http://localhost:11434',
  model_name text NOT NULL DEFAULT 'qwen3:1.7b',
  max_candidates int NOT NULL DEFAULT 3 CHECK (max_candidates BETWEEN 1 AND 10),
  max_depth int NOT NULL DEFAULT 3 CHECK (max_depth BETWEEN 1 AND 5),
  confidence_threshold numeric(4,3) NOT NULL DEFAULT 0.85
    CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
  auto_accept_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS classifier_settings_set_updated_at ON classifier_settings;
CREATE TRIGGER classifier_settings_set_updated_at
  BEFORE UPDATE ON classifier_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Initiale Default-Zeile (idempotent)
INSERT INTO classifier_settings (ollama_base_url, model_name)
SELECT 'http://localhost:11434', 'qwen3:1.7b'
WHERE NOT EXISTS (SELECT 1 FROM classifier_settings);
