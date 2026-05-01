-- Migration: Topic-Vorschläge durch LLM
-- Erweitert topics um topic_status, proposed_by_llm, proposed_from_item_id, merged_into_topic_id
-- Schützt Level-1-Roots davor, je 'suggested' oder 'proposed_by_llm=true' zu werden

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
