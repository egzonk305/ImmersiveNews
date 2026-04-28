-- Migration: topics um description, is_fixed_root, updated_at erweitern
-- + Trigger für Level-Berechnung, Max-Tiefe, Root-Schutz, updated_at
-- + NULL-safe Unique-Constraint auf (lower(name), parent_id)

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_fixed_root boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ─── updated_at Trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS topics_set_updated_at ON topics;
CREATE TRIGGER topics_set_updated_at
  BEFORE UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ─── Level automatisch aus parent_id berechnen ─────────────────────────
CREATE OR REPLACE FUNCTION topics_compute_level()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_level int;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.level = 1;
  ELSE
    SELECT level INTO parent_level FROM topics WHERE id = NEW.parent_id;
    IF parent_level IS NULL THEN
      RAISE EXCEPTION 'Parent topic % nicht gefunden', NEW.parent_id;
    END IF;
    NEW.level = parent_level + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS topics_compute_level_trg ON topics;
CREATE TRIGGER topics_compute_level_trg
  BEFORE INSERT OR UPDATE OF parent_id ON topics
  FOR EACH ROW
  EXECUTE FUNCTION topics_compute_level();

-- ─── Max-Tiefe 5 erzwingen ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION topics_enforce_max_depth()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.level > 5 THEN
    RAISE EXCEPTION 'Topic-Tiefe % überschreitet das Maximum von 5', NEW.level;
  END IF;
  IF NEW.level < 1 THEN
    RAISE EXCEPTION 'Topic-Level muss >= 1 sein';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS topics_enforce_max_depth_trg ON topics;
CREATE TRIGGER topics_enforce_max_depth_trg
  BEFORE INSERT OR UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION topics_enforce_max_depth();

-- ─── Root-Topics schützen ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION topics_protect_root()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_fixed_root THEN
      RAISE EXCEPTION 'Geschütztes Root-Topic "%" darf nicht gelöscht werden', OLD.name;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.is_fixed_root THEN
    IF NEW.name <> OLD.name THEN
      RAISE EXCEPTION 'Geschütztes Root-Topic "%" darf nicht umbenannt werden', OLD.name;
    END IF;
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
      RAISE EXCEPTION 'Geschütztes Root-Topic "%" darf nicht verschoben werden', OLD.name;
    END IF;
    IF NEW.is_fixed_root <> OLD.is_fixed_root THEN
      RAISE EXCEPTION 'is_fixed_root von "%" darf nicht geändert werden', OLD.name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS topics_protect_root_update ON topics;
CREATE TRIGGER topics_protect_root_update
  BEFORE UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION topics_protect_root();

DROP TRIGGER IF EXISTS topics_protect_root_delete ON topics;
CREATE TRIGGER topics_protect_root_delete
  BEFORE DELETE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION topics_protect_root();

-- ─── NULL-safer Unique-Index auf (lower(name), parent_id) ───────────────
DROP INDEX IF EXISTS topics_name_parent_unique;
CREATE UNIQUE INDEX topics_name_parent_unique
  ON topics (lower(name), COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));
