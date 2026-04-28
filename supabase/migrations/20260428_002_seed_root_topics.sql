-- Migration: Seed der 4 fixen Root-Themen
-- Idempotent: ON CONFLICT DO NOTHING via Unique-Index aus 001

INSERT INTO topics (name, parent_id, level, is_fixed_root, description)
VALUES
  ('Sport',   NULL, 1, true, 'Sportnachrichten: Fußball, Basketball, Tennis, Golf, etc.'),
  ('Natur',   NULL, 1, true, 'Natur, Umwelt, Klima, Tierwelt, Geographie.'),
  ('Technik', NULL, 1, true, 'Technologie, IT, KI, Hardware, Software, Wissenschaft.'),
  ('Politik', NULL, 1, true, 'Politik, Wirtschaft, Gesellschaft, internationale Beziehungen.')
ON CONFLICT DO NOTHING;
