-- Dynamic News Paths: tiefe Topic-Pfade, Story-Cluster und KI-Metadaten

-- Topic-Tiefe auf 8 erhoehen (bestehender Trigger ruft diese Funktion auf)
CREATE OR REPLACE FUNCTION topics_validate_depth()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.level > 8 THEN
    RAISE EXCEPTION 'Topic-Tiefe % ueberschreitet das Maximum von 8', NEW.level;
  END IF;
  IF NEW.level < 1 THEN
    RAISE EXCEPTION 'Topic-Level muss >= 1 sein';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  cn text;
BEGIN
  FOR cn IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'classifier_settings'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%max_depth%'
  LOOP
    EXECUTE format('ALTER TABLE classifier_settings DROP CONSTRAINT %I', cn);
  END LOOP;
END $$;

ALTER TABLE classifier_settings
  ADD CONSTRAINT classifier_settings_max_depth_check
  CHECK (max_depth BETWEEN 1 AND 8);

CREATE OR REPLACE FUNCTION immutable_topic_slug(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(coalesce(input, '')), 'ä', 'ae', 'g'),
            'ö', 'oe', 'g'
          ),
          'ü', 'ue', 'g'
        ),
        'ß', 'ss', 'g'
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-+', '-', 'g'
  ));
$$;

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS canonical_name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS topic_type text,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_created boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS usage_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

UPDATE topics
SET
  canonical_name = COALESCE(canonical_name, name),
  slug = COALESCE(NULLIF(slug, ''), immutable_topic_slug(name)),
  topic_type = COALESCE(topic_type, CASE WHEN parent_id IS NULL THEN 'root' ELSE 'topic' END)
WHERE canonical_name IS NULL OR slug IS NULL OR slug = '' OR topic_type IS NULL;

-- Bestehende Daten koennen bereits gleich benannte Geschwister enthalten.
-- Vor dem Unique-Index bekommen nur die Duplikate einen stabilen ID-Suffix.
WITH duplicates AS (
  SELECT
    id,
    slug,
    row_number() OVER (
      PARTITION BY parent_id, slug
      ORDER BY is_fixed_root DESC, usage_count DESC, created_at ASC, id ASC
    ) AS rn
  FROM topics
  WHERE parent_id IS NOT NULL
    AND slug IS NOT NULL
)
UPDATE topics t
SET slug = duplicates.slug || '-' || left(replace(t.id::text, '-', ''), 8)
FROM duplicates
WHERE t.id = duplicates.id
  AND duplicates.rn > 1;

WITH duplicate_roots AS (
  SELECT
    id,
    slug,
    row_number() OVER (
      PARTITION BY slug
      ORDER BY is_fixed_root DESC, usage_count DESC, created_at ASC, id ASC
    ) AS rn
  FROM topics
  WHERE parent_id IS NULL
    AND slug IS NOT NULL
)
UPDATE topics t
SET slug = duplicate_roots.slug || '-' || left(replace(t.id::text, '-', ''), 8)
FROM duplicate_roots
WHERE t.id = duplicate_roots.id
  AND duplicate_roots.rn > 1;

ALTER TABLE topics
  ALTER COLUMN canonical_name SET DEFAULT '',
  ALTER COLUMN topic_type SET DEFAULT 'topic';

CREATE INDEX IF NOT EXISTS topics_slug_idx ON topics(slug);
CREATE UNIQUE INDEX IF NOT EXISTS topics_parent_slug_unique_idx
  ON topics(parent_id, slug)
  WHERE parent_id IS NOT NULL AND slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS topics_root_slug_unique_idx
  ON topics(slug)
  WHERE parent_id IS NULL AND slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS topics_parent_slug_idx ON topics(parent_id, slug);
CREATE INDEX IF NOT EXISTS topics_root_idx ON topics(parent_id) WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS topics_topic_type_idx ON topics(topic_type);
CREATE INDEX IF NOT EXISTS topics_auto_created_idx ON topics(auto_created);
CREATE INDEX IF NOT EXISTS topics_last_seen_idx ON topics(last_seen_at DESC);

CREATE OR REPLACE FUNCTION topics_set_dynamic_defaults()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.canonical_name = COALESCE(NULLIF(NEW.canonical_name, ''), NEW.name);
  NEW.slug = COALESCE(NULLIF(NEW.slug, ''), immutable_topic_slug(NEW.canonical_name));
  NEW.topic_type = COALESCE(NULLIF(NEW.topic_type, ''), CASE WHEN NEW.parent_id IS NULL THEN 'root' ELSE 'topic' END);
  IF NEW.parent_id IS NULL THEN
    NEW.auto_created = false;
    NEW.topic_type = 'root';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS topics_set_dynamic_defaults_trg ON topics;
CREATE TRIGGER topics_set_dynamic_defaults_trg
  BEFORE INSERT OR UPDATE OF name, canonical_name, slug, parent_id, topic_type ON topics
  FOR EACH ROW
  EXECUTE FUNCTION topics_set_dynamic_defaults();

CREATE OR REPLACE FUNCTION topics_protect_root()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_fixed_root THEN
      RAISE EXCEPTION 'Root-Topic "%" darf nicht geloescht werden', OLD.name;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_fixed_root THEN
    IF NEW.name <> OLD.name THEN
      RAISE EXCEPTION 'Root-Topic "%" darf nicht umbenannt werden', OLD.name;
    END IF;
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
      RAISE EXCEPTION 'Root-Topic "%" darf nicht verschoben werden', OLD.name;
    END IF;
    IF NEW.is_fixed_root IS DISTINCT FROM OLD.is_fixed_root THEN
      RAISE EXCEPTION 'Root-Schutz darf nicht entfernt werden';
    END IF;
    IF NEW.auto_created THEN
      RAISE EXCEPTION 'Root-Topic "%" darf nicht auto_created=true sein', OLD.name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE incoming_items
  ADD COLUMN IF NOT EXISTS ai_headline text,
  ADD COLUMN IF NOT EXISTS ai_description text,
  ADD COLUMN IF NOT EXISTS ai_summary_short text,
  ADD COLUMN IF NOT EXISTS story_key text,
  ADD COLUMN IF NOT EXISTS story_id uuid,
  ADD COLUMN IF NOT EXISTS latest_in_story boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_entities jsonb,
  ADD COLUMN IF NOT EXISTS ai_paths jsonb,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

CREATE INDEX IF NOT EXISTS incoming_items_content_hash_idx ON incoming_items(content_hash);
CREATE INDEX IF NOT EXISTS incoming_items_story_key_idx ON incoming_items(story_key);
CREATE INDEX IF NOT EXISTS incoming_items_processed_at_idx ON incoming_items(processed_at DESC);
CREATE INDEX IF NOT EXISTS incoming_items_latest_in_story_idx
  ON incoming_items(latest_in_story)
  WHERE latest_in_story = true;

CREATE TABLE IF NOT EXISTS news_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_key text UNIQUE NOT NULL,
  root_topic text NOT NULL,
  title text NOT NULL,
  current_summary text,
  latest_item_id uuid REFERENCES incoming_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS story_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES news_stories(id) ON DELETE CASCADE,
  incoming_item_id uuid NOT NULL REFERENCES incoming_items(id) ON DELETE CASCADE,
  relation text NOT NULL DEFAULT 'related',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id, incoming_item_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'incoming_items_story_id_fkey'
      AND conrelid = 'incoming_items'::regclass
  ) THEN
    ALTER TABLE incoming_items
      ADD CONSTRAINT incoming_items_story_id_fkey
      FOREIGN KEY (story_id) REFERENCES news_stories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS news_stories_story_key_idx ON news_stories(story_key);
CREATE INDEX IF NOT EXISTS news_stories_root_topic_idx ON news_stories(root_topic);
CREATE INDEX IF NOT EXISTS news_stories_updated_at_idx ON news_stories(updated_at DESC);
CREATE INDEX IF NOT EXISTS story_items_story_id_idx ON story_items(story_id);
CREATE INDEX IF NOT EXISTS story_items_incoming_item_id_idx ON story_items(incoming_item_id);

DROP TRIGGER IF EXISTS news_stories_updated_at_trg ON news_stories;
CREATE TRIGGER news_stories_updated_at_trg
  BEFORE UPDATE ON news_stories
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE VIEW topic_paths_view AS
WITH RECURSIVE walk AS (
  SELECT
    t.id AS topic_id,
    t.name,
    t.parent_id,
    t.level,
    ARRAY[t.name]::text[] AS path_names,
    ARRAY[t.id]::uuid[] AS path_ids,
    t.name AS root_topic
  FROM topics t
  WHERE t.parent_id IS NULL

  UNION ALL

  SELECT
    child.id AS topic_id,
    child.name,
    child.parent_id,
    child.level,
    walk.path_names || child.name,
    walk.path_ids || child.id,
    walk.root_topic
  FROM topics child
  JOIN walk ON child.parent_id = walk.topic_id
)
SELECT
  topic_id,
  path_names,
  path_ids,
  array_length(path_names, 1) AS depth,
  root_topic
FROM walk;

CREATE OR REPLACE FUNCTION get_topic_path(topic_id uuid)
RETURNS TABLE(
  topic_id uuid,
  path_names text[],
  path_ids uuid[],
  depth int,
  root_topic text
)
LANGUAGE sql
STABLE
AS $$
  SELECT tpv.topic_id, tpv.path_names, tpv.path_ids, tpv.depth, tpv.root_topic
  FROM topic_paths_view tpv
  WHERE tpv.topic_id = get_topic_path.topic_id;
$$;

DROP VIEW IF EXISTS topics_with_path CASCADE;

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
    t.canonical_name,
    t.slug,
    t.topic_type,
    t.auto_created,
    t.last_seen_at,
    t.usage_count,
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
    t.canonical_name,
    t.slug,
    t.topic_type,
    t.auto_created,
    t.last_seen_at,
    t.usage_count,
    walk.path_array || t.name,
    (walk.full_path || ' > ' || t.name)::text
  FROM topics t
  JOIN walk ON t.parent_id = walk.id
)
SELECT * FROM walk;

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
  (SELECT count(*) FROM topics WHERE topic_status = 'suggested') AS suggested_topics_count,
  (SELECT count(*) FROM topics WHERE auto_created = true) AS auto_created_topics,
  (SELECT count(*) FROM news_stories) AS story_count,
  (SELECT round(avg(duration_ms)::numeric, 0) FROM classification_runs
     WHERE duration_ms IS NOT NULL) AS avg_processing_ms;
