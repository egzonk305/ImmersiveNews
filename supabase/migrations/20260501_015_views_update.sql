-- Migration: Views aktualisieren (Lifecycle-Counts, vorgeschlagene Topics)
-- + get_allowed_topics filtert auf topic_status='active'

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

-- get_allowed_topics: nur aktive Topics für LLM-Prompt
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

-- View: ausstehende Topic-Vorschläge mit Vorschlags-Item-Titel und Eltern-Pfad
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

-- topics_with_path: ergänze topic_status für UI-Filter
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
