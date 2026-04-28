-- Migration: Views und RPCs für Dashboard, Topic-Pfad, KI-Prompt

-- ─── topics_with_path: rekursive Pfaddarstellung ─────────────────────────
CREATE OR REPLACE VIEW topics_with_path AS
WITH RECURSIVE walk AS (
  SELECT
    t.id,
    t.name,
    t.parent_id,
    t.level,
    t.description,
    t.is_fixed_root,
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
    walk.path_array || t.name,
    walk.full_path || ' > ' || t.name
  FROM topics t
  INNER JOIN walk ON t.parent_id = walk.id
)
SELECT * FROM walk;

-- ─── RPC: Erlaubte Topics für KI-Prompt ──────────────────────────────────
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
  SELECT id, name, level, full_path, path_array
  FROM topics_with_path
  ORDER BY full_path;
$$;

-- ─── Root-Topic eines Items ableiten (für Dashboard-Aggregation) ─────────
CREATE OR REPLACE FUNCTION topic_root_id(t uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE up AS (
    SELECT id, parent_id FROM topics WHERE id = t
    UNION ALL
    SELECT topics.id, topics.parent_id
    FROM topics JOIN up ON topics.id = up.parent_id
  )
  SELECT id FROM up WHERE parent_id IS NULL LIMIT 1;
$$;

-- ─── Dashboard-Statistiken ───────────────────────────────────────────────
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
  (SELECT round(avg(confidence)::numeric, 3) FROM incoming_item_topics
     WHERE source = 'llm' AND is_primary = true) AS avg_primary_confidence;

-- ─── Items pro Root-Thema ────────────────────────────────────────────────
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

-- ─── Items mit niedriger Konfidenz ───────────────────────────────────────
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

-- ─── Letzte Klassifizierungen mit Item-Title ──────────────────────────────
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
