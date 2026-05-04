-- =============================================================================
-- COMBINED MIGRATION 010–015
-- Ausführen: als einzelnes Script im Supabase SQL Editor
-- =============================================================================


-- =============================================================================
-- 010: Topic-Vorschläge
-- Erweitert topics um topic_status, proposed_by_llm etc.
-- =============================================================================

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS topic_status text NOT NULL DEFAULT 'active'
    CHECK (topic_status IN ('active','suggested','rejected')),
  ADD COLUMN IF NOT EXISTS proposed_by_llm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proposed_from_item_id uuid
    REFERENCES incoming_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_into_topic_id uuid
    REFERENCES topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS topics_status_suggested_idx
  ON topics(topic_status)
  WHERE topic_status = 'suggested';

CREATE INDEX IF NOT EXISTS topics_proposed_by_llm_idx
  ON topics(proposed_by_llm)
  WHERE proposed_by_llm = true;

-- Schutz: Level-1 Roots dürfen nie 'suggested'/'rejected' oder proposed_by_llm sein
CREATE OR REPLACE FUNCTION topics_protect_root_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.level = 1 THEN
    IF NEW.topic_status <> 'active' THEN
      RAISE EXCEPTION 'Root-Topic "%" muss topic_status=active behalten', NEW.name;
    END IF;
    IF NEW.proposed_by_llm THEN
      RAISE EXCEPTION 'Root-Topic "%" darf nicht proposed_by_llm=true sein', NEW.name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS topics_protect_root_status_trg ON topics;
CREATE TRIGGER topics_protect_root_status_trg
  BEFORE INSERT OR UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION topics_protect_root_status();


-- =============================================================================
-- 011: Lifecycle und Enrichment auf incoming_items
-- =============================================================================

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

-- target_topic_id FK auf ON DELETE SET NULL umstellen
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

-- incoming_item_topics: Composite-Indizes
CREATE INDEX IF NOT EXISTS iit_item_status_idx
  ON incoming_item_topics(incoming_item_id, status);

CREATE INDEX IF NOT EXISTS iit_status_suggested_idx
  ON incoming_item_topics(status)
  WHERE status = 'suggested';

-- Views droppen die von confidence abhängen (werden am Ende neu erstellt)
DROP VIEW IF EXISTS low_confidence_items CASCADE;
DROP VIEW IF EXISTS dashboard_stats CASCADE;
DROP VIEW IF EXISTS items_per_root CASCADE;
DROP VIEW IF EXISTS recent_classifications CASCADE;

-- Confidence-Präzision erhöhen: numeric(4,3) → numeric(5,4)
ALTER TABLE incoming_item_topics
  ALTER COLUMN confidence TYPE numeric(5,4);

ALTER TABLE classifier_settings
  ALTER COLUMN confidence_threshold TYPE numeric(5,4);


-- =============================================================================
-- 012: classifier_settings und rss_feeds erweitern
-- =============================================================================

ALTER TABLE classifier_settings
  ADD COLUMN IF NOT EXISTS temperature numeric(3,2) NOT NULL DEFAULT 0.10
    CHECK (temperature >= 0 AND temperature <= 2),
  ADD COLUMN IF NOT EXISTS num_ctx int NOT NULL DEFAULT 8192
    CHECK (num_ctx BETWEEN 512 AND 131072),
  ADD COLUMN IF NOT EXISTS num_predict int NOT NULL DEFAULT 400
    CHECK (num_predict BETWEEN 16 AND 8192),
  ADD COLUMN IF NOT EXISTS timeout_ms int NOT NULL DEFAULT 360000
    CHECK (timeout_ms BETWEEN 1000 AND 1800000),

  ADD COLUMN IF NOT EXISTS min_stage_confidence numeric(5,4) NOT NULL DEFAULT 0.5
    CHECK (min_stage_confidence >= 0 AND min_stage_confidence <= 1),
  ADD COLUMN IF NOT EXISTS topic_similarity_threshold numeric(5,4) NOT NULL DEFAULT 0.7
    CHECK (topic_similarity_threshold >= 0 AND topic_similarity_threshold <= 1),
  ADD COLUMN IF NOT EXISTS max_new_topics_per_item int NOT NULL DEFAULT 2
    CHECK (max_new_topics_per_item BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS auto_accept_new_topics boolean NOT NULL DEFAULT false,

  ADD COLUMN IF NOT EXISTS enrichment_enabled_global boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enrichment_min_description_chars int NOT NULL DEFAULT 200
    CHECK (enrichment_min_description_chars BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS enrichment_fetch_timeout_ms int NOT NULL DEFAULT 10000
    CHECK (enrichment_fetch_timeout_ms BETWEEN 1000 AND 60000),
  ADD COLUMN IF NOT EXISTS enrichment_max_chars int NOT NULL DEFAULT 50000
    CHECK (enrichment_max_chars BETWEEN 1000 AND 500000),

  ADD COLUMN IF NOT EXISTS prompt_template text,
  ADD COLUMN IF NOT EXISTS reclassify_on_update boolean NOT NULL DEFAULT false,

  ADD COLUMN IF NOT EXISTS fresh_ttl_hours int NOT NULL DEFAULT 48
    CHECK (fresh_ttl_hours BETWEEN 1 AND 8760),
  ADD COLUMN IF NOT EXISTS archive_retention_days int NOT NULL DEFAULT 30
    CHECK (archive_retention_days BETWEEN 1 AND 3650),
  ADD COLUMN IF NOT EXISTS keep_approved_forever boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS keep_with_topic_associations boolean NOT NULL DEFAULT true;

ALTER TABLE classifier_settings
  ALTER COLUMN max_depth SET DEFAULT 5;

ALTER TABLE rss_feeds
  ADD COLUMN IF NOT EXISTS enrichment_enabled boolean,
  ADD COLUMN IF NOT EXISTS fresh_ttl_hours_override int
    CHECK (fresh_ttl_hours_override IS NULL OR fresh_ttl_hours_override BETWEEN 1 AND 8760);

CREATE INDEX IF NOT EXISTS rss_feeds_active_idx
  ON rss_feeds(is_active) WHERE is_active = true;


-- =============================================================================
-- 013: classifier_prompts Tabelle + prompt_hash Spalte
-- Hinweis: Bestehende Prompt-Texte bleiben in classification_runs erhalten.
--          Die Deduplication ist optional und wird im Code noch nicht aktiv genutzt.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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


-- =============================================================================
-- 014: pg_trgm, lifecycle_runs, enrichment_cache
-- FIX: byte_length ist eine normale Spalte (kein GENERATED ALWAYS AS),
--      da der App-Code den Wert selbst berechnet und setzt.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS topics_name_trgm_idx
  ON topics USING gin (lower(name) gin_trgm_ops);

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

CREATE TABLE IF NOT EXISTS enrichment_cache (
  url text PRIMARY KEY,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  content text,
  status text NOT NULL CHECK (status IN ('success','failed')),
  error text,
  byte_length int
);

CREATE INDEX IF NOT EXISTS enrichment_cache_fetched_idx
  ON enrichment_cache(fetched_at);


-- =============================================================================
-- 015: Views aktualisieren
-- =============================================================================

CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  (SELECT count(*) FROM rss_feeds WHERE is_active) AS active_feeds,
  (SELECT count(*) FROM incoming_items WHERE processing_state = 'pending') AS pending_items,
  (SELECT count(*) FROM incoming_items WHERE processing_state = 'processing') AS processing_items,
  (SELECT count(*) FROM incoming_items WHERE processing_state = 'classified') AS classified_items,
  (SELECT count(*) FROM incoming_items WHERE processing_state = 'failed') AS failed_items,
  (SELECT count(*) FROM incoming_items WHERE processing_state = 'done') AS done_items,
  (SELECT count(*) FROM incoming_items WHERE status = 'pending') AS review_pending,
  (SELECT count(*) FROM incoming_items WHERE created_at > now() - interval '24 hours') AS items_last_24h,
  (SELECT round(avg(confidence)::numeric, 4) FROM incoming_item_topics
     WHERE source = 'llm' AND is_primary = true) AS avg_primary_confidence,
  (SELECT count(*) FROM incoming_items WHERE lifecycle_state = 'fresh') AS fresh_items,
  (SELECT count(*) FROM incoming_items WHERE lifecycle_state = 'archived') AS archived_items,
  (SELECT count(*) FROM topics WHERE topic_status = 'suggested') AS suggested_topics_count;

CREATE OR REPLACE FUNCTION get_allowed_topics()
RETURNS TABLE(
  id uuid,
  name text,
  level int,
  full_path text,
  path_array text[]
)
LANGUAGE sql
STABLE
AS $$
  SELECT twp.id, twp.name, twp.level, twp.full_path, twp.path_array
  FROM topics_with_path twp
  JOIN topics t ON t.id = twp.id
  WHERE t.topic_status = 'active'
  ORDER BY twp.full_path;
$$;

CREATE OR REPLACE VIEW pending_topic_suggestions AS
SELECT
  t.id,
  t.name,
  t.parent_id,
  t.level,
  t.proposed_from_item_id,
  ii.title AS proposed_from_item_title,
  parent_twp.full_path AS parent_full_path,
  t.created_at
FROM topics t
LEFT JOIN incoming_items ii ON ii.id = t.proposed_from_item_id
LEFT JOIN topics_with_path parent_twp ON parent_twp.id = t.parent_id
WHERE t.topic_status = 'suggested'
ORDER BY t.created_at DESC;

CREATE OR REPLACE VIEW topics_with_path AS
WITH RECURSIVE walk AS (
  SELECT
    t.id,
    t.name,
    t.parent_id,
    t.level,
    t.description,
    t.is_fixed_root,
    t.topic_status,
    t.proposed_by_llm,
    ARRAY[t.name]::text[] AS path_array,
    t.name::text AS full_path
  FROM topics t
  WHERE t.parent_id IS NULL

  UNION ALL

  SELECT
    t.id,
    t.name,
    t.parent_id,
    t.level,
    t.description,
    t.is_fixed_root,
    t.topic_status,
    t.proposed_by_llm,
    walk.path_array || t.name,
    walk.full_path || ' > ' || t.name
  FROM topics t
  INNER JOIN walk ON t.parent_id = walk.id
)
SELECT * FROM walk;

-- ─── Views die gedroppt wurden wiederherstellen ───────────────────────────

CREATE OR REPLACE VIEW items_per_root AS
SELECT
  r.id AS root_id,
  r.name AS root_name,
  count(DISTINCT iit.incoming_item_id) AS item_count
FROM topics r
LEFT JOIN incoming_item_topics iit ON
  iit.is_primary = true
  AND topic_root_id(iit.topic_id) = r.id
WHERE r.is_fixed_root = true
GROUP BY r.id, r.name
ORDER BY r.name;

CREATE OR REPLACE VIEW low_confidence_items AS
SELECT
  ii.id AS item_id,
  ii.title,
  ii.created_at,
  iit.topic_id,
  iit.confidence,
  iit.reason,
  cs.confidence_threshold
FROM incoming_items ii
JOIN incoming_item_topics iit ON iit.incoming_item_id = ii.id AND iit.is_primary = true
CROSS JOIN LATERAL (SELECT confidence_threshold FROM classifier_settings LIMIT 1) cs
WHERE iit.source = 'llm'
  AND iit.confidence IS NOT NULL
  AND iit.confidence < cs.confidence_threshold
  AND ii.processing_state IN ('classified','done')
ORDER BY iit.confidence ASC;

CREATE OR REPLACE VIEW recent_classifications AS
SELECT
  cr.id,
  cr.incoming_item_id,
  ii.title AS item_title,
  cr.model,
  cr.status,
  cr.duration_ms,
  cr.error_message,
  cr.created_at
FROM classification_runs cr
LEFT JOIN incoming_items ii ON ii.id = cr.incoming_item_id
ORDER BY cr.created_at DESC;
