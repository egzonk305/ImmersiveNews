# ImmersiveNews — Projektstatus

**Stand:** 2026-05-06  
**Branch:** `main`

---

## Architektur-Übersicht

**Konzept:** RSS-Artikel werden von Ollama (lokal, CPU-only) klassifiziert. Die KI generiert dabei einen hierarchischen Pfad (z.B. `["Sport", "Fußball", "Champions League", "Finale"]`). Das System legt fehlende Topic-Knoten automatisch an. Artikel landen am Blatt-Knoten des Pfads. Endprodukt: Vision Pro Drill-Down-UI von 4 Root-Topics bis zum Artikel.

**Fixe Root-Topics:** Sport · Natur · Technik · Politik (DB-Trigger schützt diese 4 Knoten)

---

## Was funktioniert (vollständig)

### RSS & Feeds
- Feeds verwalten, manuell fetchen, Duplikat-Erkennung via Unique-Index auf `source_url`
- Auto-Fetch via Windows Task Scheduler → `POST /api/cron/fetch-feeds`
- Per-Feed Override: `enrichment_enabled`, `fresh_ttl_hours_override`

### KI-Klassifizierung (Path-Based)
- **Modell:** qwen3:8b (lokal via Ollama, CPU-only, kein `format:'json'`)
- **Einsstufig, path-generierend:** KI erzeugt `{ root_topic, path: string[], headline, summary }` — kein Auswahl aus bestehender Liste
- **Auto-Create:** fehlende Topic-Knoten werden automatisch via `findOrCreateTopicPath()` angelegt (`auto_created=true`)
- **Item-Update nach Klassifizierung:** `processing_state='done'`, `status='approved'`, `target_topic_id`=Blatt-UUID, `ai_headline`, `ai_description`, `ai_summary_short`
- **Quirks:** `think: false`, kein JSON-Priming, `<think>`-Blöcke werden herausgefiltert
- **Settings aus DB:** temperature, num_ctx, num_predict, timeout_ms aus `classifier_settings`

### Klassifizierungs-APIs
- `POST /api/classify/[itemId]` — einzelnes Item klassifizieren
- `POST /api/classify/batch` — Batch sequenziell (ids[] oder all_pending)
- `POST /api/classify/batch-parallel` — Parallel mit `concurrency`-Parameter
- `POST /api/classify/pending` — alle pending/failed Items bis limit
- `POST /api/classify/smoke` — Smoke-Test (legt Test-Item an, klassifiziert es)
- `POST /api/review/[id]/reclassify` — Re-Klassifizierung aus Review-UI

### Content-Enrichment
- Service: `src/lib/services/enrichment.service.ts`
- Cache-first: prüft `enrichment_cache` Tabelle vor HTTP-Fetch
- Extraktion via `@mozilla/readability` + `jsdom`
- Automatisch vor Klassifizierung wenn `enrichment_enabled_global=true` und Beschreibung < `enrichment_min_description_chars` Zeichen
- Manuell: Button in Review-Detailansicht, Retry bei `failed`/`pending`
- API: `POST /api/enrich/[id]`

### Lifecycle-Management
- Service: `src/lib/services/lifecycle.service.ts`
- `fresh` → `archived` nach `fresh_ttl_hours` (Default: 48h)
- `archived` → `deleted` nach `archive_retention_days` (Default: 30 Tage)
- Schutzregeln: `keep_approved_forever`, `keep_with_topic_associations`
- Dry-Run Modus verfügbar
- Cron-Trigger: `POST /api/cron/lifecycle`
- Admin-Seite: `/lifecycle`

### Cleanup-Dashboard
- Admin-Seite: `/cleanup` (Sidebar: System → Aufräumen)
- 5 Kategorien: Pending-Items, KI-Logs, Enrichment-Cache, Abgelehnte Topics, Lifecycle-Logs
- Preview zeigt aktuelle Zählungen vor dem Löschen
- APIs: `GET /api/cleanup/preview`, `DELETE /api/cleanup/{pending-items,classification-logs,enrichment-cache,rejected-topics,lifecycle-logs}`

### Topic-Verwaltung
- Hierarchischer Baum (unbegrenzt tief), auto-wächst durch Klassifizierung
- Fixe Root-Topics: Sport, Natur, Technik, Politik (DB-Trigger schützt sie)
- `auto_created=true` für KI-generierte Knoten
- Topic-Vorschläge: `/topic-suggestions` — annehmen (→ `active`) oder ablehnen (→ `rejected`)
- Baum-Browser: Verbindungslinien, Expand/Collapse-Toolbar, Inline-Kind-Anlage, State-Cache

### Review-Flow
- Review-Queue (`/review`), klassifizierte Items anzeigen, Bulk-Approve
- Klassifizierter Topic-Pfad (Blatt-Name) in Detailansicht sichtbar
- Manuelles Topic-Assignment via TopicPicker
- Enrichment-Status in Detailansicht, Fortschrittsbalken bei Batch-Klassifizierung

### Admin-UI
- Dashboard, KI-Logs, Schema-Viewer, Import/Export
- Sidebar: Übersicht / Inhalte / KI / System (inkl. Aufräumen)

---

## Supabase-Setup

### Migrationen (in `supabase/migrations/`)
Alle Migrationen wurden manuell im Supabase SQL-Editor ausgeführt (kein CLI-Tracking).

| Datei | Zweck |
|---|---|
| `20260413_helper_functions.sql` | Rekursive Topic-Funktionen (subtree, ancestors) |
| `20260428_001_topics_extend.sql` | description, is_fixed_root, Trigger, Unique-Index |
| `20260428_002_seed_root_topics.sql` | Root-Topics Sport/Natur/Technik/Politik |
| `20260428_003_rss_feeds_extend.sql` | root_topic_id, start_topic_id |
| `20260428_004_incoming_items_extend.sql` | content, published_at, processing_state, Enrichment-Felder |
| `20260428_005_incoming_item_topics.sql` | Junction-Tabelle Item ↔ Topic mit confidence |
| `20260428_006_classification_runs.sql` | KI-Klassifizierungs-Logs |
| `20260428_007_classifier_settings.sql` | Singleton-Config (Ollama, Schwellwerte) |
| `20260428_008_views_and_helpers.sql` | Views & RPC-Funktionen |
| `20260501_010_topic_suggestions.sql` | Topic-Vorschläge |
| `20260501_011_incoming_items_lifecycle.sql` | Lifecycle-State, TTL-Felder |
| `20260501_012_classifier_settings_extend.sql` | Enrichment & Lifecycle-Settings |
| `20260501_013_classification_runs_dedupe.sql` | Deduplizierung für Classification-Runs |
| `20260501_014_pg_trgm_lifecycle_runs_cache.sql` | Postgres Full-Text-Indizes |
| `20260501_015_views_update.sql` | Views für neue Felder aktualisiert |
| `20260505_016_performance_indexes.sql` | Performance-Indizes + `cleanup_orphaned_prompts` |
| `20260505_017_dynamic_news_paths.sql` | news_stories, story_items, Semantic Paths (Tabellen bleiben, Service nicht mehr genutzt) |
| `20260506_018_fk_indexes_cleanup.sql` | FK-Indizes (6 Stück) + Duplikat-Index entfernt |

Für Neuinstallation: `001–008` ausführen, dann `010–018` in Reihenfolge.

### Wichtige Tabellen
| Tabelle | Zweck |
|---|---|
| `topics` | Topic-Baum; `is_fixed_root` schützt 4 Roots; `auto_created` für KI-Knoten |
| `incoming_items` | RSS-Items mit `target_topic_id`, `ai_headline`, `ai_description`, `ai_summary_short` |
| `incoming_item_topics` | Kandidaten-Zuordnungen (für manuelle Zuordnung via TopicPicker) |
| `classifier_settings` | Singleton-Config (temperature, num_ctx, enrichment, lifecycle …) |
| `classification_runs` | KI-Logs mit Raw-Response und Prompt |
| `enrichment_cache` | URL → extrahierter Volltext, gecacht |
| `lifecycle_runs` | Audit-Log für Archivierungs-Runs |
| `news_stories` | Semantische News-Stories (angelegt, derzeit nicht aktiv genutzt) |

### Views
| View | Zweck |
|---|---|
| `topics_with_path` | Topics mit `full_path` und `path_array` |
| `dashboard_stats` | Kennzahlen für Dashboard |
| `pending_topic_suggestions` | Topics mit `topic_status='suggested'` |
| `low_confidence_items` | Items unter Konfidenz-Schwelle |
| `recent_classifications` | Letzte KI-Runs |
| `items_per_root` | Item-Anzahl pro Root-Topic |
| `topic_paths_view` | Topic-Pfade |

---

## Lokales Setup

```powershell
# Ollama starten
ollama serve
ollama pull qwen3:8b

# Dev-Server
npm run dev
```

**Ollama-Einstellungen in classifier_settings:**
```sql
UPDATE classifier_settings SET
  model_name = 'qwen3:8b',
  temperature = 0.1,
  num_ctx = 8192,
  num_predict = 500,
  timeout_ms = 360000;
```

---

## Wichtige Dateien

| Datei | Zweck |
|---|---|
| `src/lib/services/path-classifier.service.ts` | **Haupt-Classifier:** Path-Generierung + Topic-Auto-Create |
| `src/lib/prompts/path-classifier-prompt.ts` | Prompt-Builder für Path-Klassifizierung |
| `src/lib/services/enrichment.service.ts` | Volltext-Extraktion, cache-first |
| `src/lib/services/lifecycle.service.ts` | Archivierung/Löschung nach TTL |
| `src/lib/services/feed.service.ts` | RSS-Fetch und Parsing |
| `src/lib/services/ollama.client.ts` | HTTP-Wrapper, `think: false`, konfigurierbare Parameter |
| `src/lib/validators/classifier.schema.ts` | Zod-Schemas inkl. `pathClassificationSchema` |
| `src/lib/types/database.types.ts` | Alle DB-Typen (manuell gepflegt) |
| `src/app/(admin)/review/page.tsx` | Review-Queue (Client Component) |
| `src/app/(admin)/cleanup/page.tsx` | Cleanup-Dashboard |
| `src/app/api/cron/fetch-feeds/route.ts` | RSS-Cron-Trigger |
| `src/app/api/cron/lifecycle/route.ts` | Lifecycle-Cron-Trigger |

---

## Bekannte Eigenheiten

- `@supabase/supabase-js` gepinnt auf `2.43.4` (neuere Versionen brechen Types mit `@supabase/ssr@0.4.0`)
- `classifier_settings` PATCH braucht `@ts-ignore` (Supabase v2 never-Type-Bug bei optionalen Feldern)
- Ollama serialisiert Requests (CPU-only) → Parallelisierung via `batch-parallel` mit `concurrency=2` praktikabel
- `database.types.ts` wird manuell gepflegt (kein `npm run db:types` wegen Remote-Supabase-Config)
- `enrichment_cache.byte_length` ist `GENERATED ALWAYS AS` in DB → wird **nicht** im INSERT gesetzt
- Supabase-Migrationen werden manuell ausgeführt (nicht via CLI) → `list_migrations` liefert leer
- Alle Views sind `SECURITY DEFINER`, alle Tabellen ohne RLS — bewusste Entscheidung (internes Tool, keine Auth)
- Supabase TS7022-Fehler bei komplexen Query-Chains in Loops → Helper-Funktionen mit `SupabaseClient<any>` als Workaround

---

## Was als nächstes sinnvoll wäre

- [ ] **Topic-Baum in Review:** Vollständigen Pfad (`topics_with_path.full_path`) im Review anzeigen, nicht nur Blatt-Name
- [ ] **Vision Pro UI:** Drill-Down-Ansicht der 4 Root-Topics → Sub-Topics → Artikel
- [ ] **Feed-Zuordnung zu Root-Topics:** `root_topic_id` auf Feeds setzen, damit Klassifizierung gezielter arbeitet
- [ ] **Windows Task Scheduler:** Lifecycle-Cron eintragen (`POST /api/cron/lifecycle`)
- [ ] **Dashboard erweitern:** Topic-Baum-Wachstum, auto-created Topics Anzahl, Klassifizierungsfortschritt
- [ ] **Enrichment-Settings in UI:** `enrichment_min_description_chars`, `enrichment_max_chars` in `/settings/classifier` anzeigen
