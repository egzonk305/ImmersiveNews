-- Migration: Hilfsfunktionen für die Admin-Plattform
-- Ausführen in: Supabase Dashboard → SQL Editor

-- ─── 1. Rekursiver Teilbaum ────────────────────────────────────────────────
-- Gibt alle Topics ab einem Root-Knoten zurück (inkl. Root selbst)
CREATE OR REPLACE FUNCTION get_topic_subtree(root_id uuid)
RETURNS TABLE(
  id         uuid,
  name       text,
  parent_id  uuid,
  level      int,
  created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE tree AS (
    SELECT t.id, t.name, t.parent_id, t.level, t.created_at
    FROM topics t
    WHERE t.id = root_id

    UNION ALL

    SELECT t.id, t.name, t.parent_id, t.level, t.created_at
    FROM topics t
    INNER JOIN tree ON t.parent_id = tree.id
  )
  SELECT * FROM tree
  ORDER BY level, name;
$$;

-- ─── 2. Breadcrumb-Pfad ────────────────────────────────────────────────────
-- Gibt alle Vorfahren eines Topics zurück (von Root bis direkt übergeordnet)
CREATE OR REPLACE FUNCTION get_topic_ancestors(topic_id uuid)
RETURNS TABLE(
  id    uuid,
  name  text,
  level int
)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT t.id, t.name, t.parent_id, t.level
    FROM topics t
    WHERE t.id = topic_id

    UNION ALL

    SELECT t.id, t.name, t.parent_id, t.level
    FROM topics t
    INNER JOIN ancestors a ON t.id = a.parent_id
  )
  SELECT id, name, level FROM ancestors
  ORDER BY level;
$$;

-- ─── 3. Duplikate finden ──────────────────────────────────────────────────
-- Zeigt Topics mit gleichem Namen (case-insensitive)
CREATE OR REPLACE VIEW duplicate_topic_names AS
SELECT
  lower(name) AS name_normalized,
  array_agg(id ORDER BY created_at) AS ids,
  array_agg(name ORDER BY created_at) AS names,
  array_agg(level ORDER BY created_at) AS levels,
  count(*) AS occurrence_count
FROM topics
GROUP BY lower(name)
HAVING count(*) > 1
ORDER BY count(*) DESC, lower(name);

-- ─── 4. Tree-Statistiken ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW topic_level_stats AS
SELECT
  level,
  count(*) AS topic_count
FROM topics
GROUP BY level
ORDER BY level;
