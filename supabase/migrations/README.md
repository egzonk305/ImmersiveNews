# Migrations

Alle Migrationen werden **manuell** im Supabase Dashboard → SQL Editor ausgeführt (kein CLI-Tracking aktiv).

## Ausführungsreihenfolge

**Voraussetzung:** Basistabellen `topics`, `rss_feeds`, `incoming_items` müssen bereits existieren (initial im Supabase-Dashboard angelegt).

### Phase 1 — Basis-Schema (001–008)
1. `20260413_helper_functions.sql` — Rekursive Hilfsfunktionen: `get_topic_subtree()`, `get_topic_ancestors()`
2. `20260428_001_topics_extend.sql` — `description`, `is_fixed_root`, Trigger, Unique-Index auf Topics
3. `20260428_002_seed_root_topics.sql` — Root-Topics anlegen: Sport, Natur, Technik, Politik
4. `20260428_003_rss_feeds_extend.sql` — `root_topic_id`, `start_topic_id` auf rss_feeds
5. `20260428_004_incoming_items_extend.sql` — `content`, `published_at`, `processing_state`, `feed_id` auf incoming_items
6. `20260428_005_incoming_item_topics.sql` — Junction-Tabelle `incoming_item_topics` (AI/manuelle Topic-Zuordnungen)
7. `20260428_006_classification_runs.sql` — Tabelle `classification_runs` (KI-Logs)
8. `20260428_007_classifier_settings.sql` — Tabelle `classifier_settings` (Singleton-Config)
9. `20260428_008_views_and_helpers.sql` — Views (`dashboard_stats`, `topics_with_path` etc.) + RPCs

### Phase 2 — Lifecycle & KI-Erweiterungen (010–015)
10. `20260501_010_topic_suggestions.sql` — `topic_status`, `proposed_by_llm`, `merged_into_topic_id` auf Topics
11. `20260501_011_incoming_items_lifecycle.sql` — `lifecycle_state`, `enriched_content`, `enrichment_status`, `content_hash`
12. `20260501_012_classifier_settings_extend.sql` — `temperature`, `num_ctx`, `num_predict`, `timeout_ms`, Schwellwerte
13. `20260501_013_classification_runs_dedupe.sql` — Tabelle `classifier_prompts` (Prompt-Deduplizierung via SHA256)
14. `20260501_014_pg_trgm_lifecycle_runs_cache.sql` — pg_trgm-Extension, `lifecycle_runs`, `enrichment_cache`, `match_topic_by_name()`
15. `20260501_015_views_update.sql` — Views für Lifecycle und Topic-Suggestions aktualisiert

### Phase 3 — Performance & Features (016–018)
16. `20260505_016_performance_indexes.sql` — Performance-Indizes, `cleanup_orphaned_prompts()`
17. `20260505_017_dynamic_news_paths.sql` — Topic-Tiefe auf 8, `news_stories`, `story_items`, `topic_paths_view`, Dynamic-Path-Felder auf incoming_items
18. `20260506_018_fk_indexes_cleanup.sql` — 6 fehlende FK-Indizes, Duplikat-Index entfernt

## Nach Migrationen

DB-Typen manuell pflegen (kein automatisches `npm run db:types` — Supabase Remote-Config nicht in `.env.local.example`):

```
src/lib/types/database.types.ts  ← manuell aktualisieren wenn Schema-Änderungen
```
