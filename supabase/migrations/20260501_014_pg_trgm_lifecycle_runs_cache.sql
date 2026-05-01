-- Migration: pg_trgm für Topic-Fuzzy-Match + lifecycle_runs + enrichment_cache

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS topics_name_trgm_idx
  ON topics USING gin (lower(name) gin_trgm_ops);

-- Fuzzy-Match-Helfer: findet best-match unter (optional) parent_id (Level >=2)
-- Gibt id+similarity zurück, oder NULL wenn unter Schwelle.
CREATE OR REPLACE FUNCTION match_topic_by_name(
  p_name text,
  p_parent_id uuid,
  p_threshold numeric
)
RETURNS TABLE(id uuid, name text, similarity real)
LANGUAGE sql
STABLE
AS $$
  SELECT t.id, t.name, similarity(lower(t.name), lower(p_name)) AS sim
  FROM topics t
  WHERE t.level >= 2
    AND (p_parent_id IS NULL OR t.parent_id = p_parent_id)
    AND t.topic_status = 'active'
    AND similarity(lower(t.name), lower(p_name)) >= p_threshold::real
  ORDER BY sim DESC
  LIMIT 1;
$$;

-- ─── Lifecycle-Runs Audit ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lifecycle_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  dry_run boolean NOT NULL DEFAULT false,
  archived_count int NOT NULL DEFAULT 0,
  deleted_count int NOT NULL DEFAULT 0,
  cache_pruned_count int NOT NULL DEFAULT 0,
  deleted_summary jsonb,
  archived_summary jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS lifecycle_runs_started_idx
  ON lifecycle_runs(started_at DESC);

-- ─── Enrichment-Cache ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrichment_cache (
  url text PRIMARY KEY,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  content text,
  status text NOT NULL CHECK (status IN ('success','failed')),
  error text,
  byte_length int GENERATED ALWAYS AS (COALESCE(length(content), 0)) STORED
);

CREATE INDEX IF NOT EXISTS enrichment_cache_fetched_idx
  ON enrichment_cache(fetched_at);
