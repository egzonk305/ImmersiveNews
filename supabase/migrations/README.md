# Migrations

Reihenfolge ist alphabetisch (Dateipräfix). Mit Supabase-CLI ausführen:

```bash
supabase db push
```

Oder manuell im Supabase-Dashboard → SQL Editor in dieser Reihenfolge:

1. `20260413_helper_functions.sql` — Topic-Subtree und -Ancestors
2. `20260428_001_topics_extend.sql` — description, is_fixed_root, Trigger, Unique-Index
3. `20260428_002_seed_root_topics.sql` — Sport, Natur, Technik, Politik
4. `20260428_003_rss_feeds_extend.sql` — root_topic_id, start_topic_id
5. `20260428_004_incoming_items_extend.sql` — content, published_at, processing_state, ...
6. `20260428_005_incoming_item_topics.sql` — Junction-Tabelle mit Konfidenz
7. `20260428_006_classification_runs.sql` — KI-Logs
8. `20260428_007_classifier_settings.sql` — Singleton-Settings
9. `20260428_008_views_and_helpers.sql` — Views + RPCs

**Voraussetzung:** Die Basistabellen `topics`, `rss_feeds`, `incoming_items` müssen bereits existieren (wurden ursprünglich manuell im Supabase-Dashboard angelegt).

Nach den Migrationen die TS-Typen regenerieren:

```bash
npm run db:types
```
