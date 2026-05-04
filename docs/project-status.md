# ImmersiveNews — Projektstatus

**Stand:** 2026-05-04  
**Branch:** `main`

---

## Was funktioniert (vollständig)

### RSS & Feeds
- Feeds verwalten, manuell fetchen, Duplikat-Erkennung via Unique-Index auf `source_url`
- Auto-Fetch via Windows Task Scheduler → `POST /api/cron/fetch-feeds`
- Per-Feed Override: `enrichment_enabled`, `fresh_ttl_hours_override`

### KI-Klassifizierung
- **Modell:** qwen3:8b (lokal via Ollama, CPU-only, kein `format:'json'`)
- **Zweistufig:** Stufe 1 → Root-Topic, Stufe 2 → Sub-Topics des Root
- **Prompt:** Numerischer Index (`1:Sport`, `2:Sport > Fußball` …), Modell antwortet mit `{"candidates":[{"n":1,"confidence":0.9,"is_primary":true}]}`
- **Quirks:** `think: false`, kein JSON-Priming mehr, `<think>`-Blöcke werden herausgefiltert
- **Settings aus DB:** temperature, num_ctx, num_predict, timeout_ms werden aus `classifier_settings` gelesen
- **Auto-Accept:** wenn confidence ≥ threshold wird Item automatisch bestätigt
- **Prompt nutzt content:** `enriched_content ?? item.content` (bis 800 Zeichen) im Prompt

### Content-Enrichment *(neu seit 2026-05-04)*
- Service: `src/lib/services/enrichment.service.ts`
- Cache-first: prüft `enrichment_cache` Tabelle vor HTTP-Fetch
- Extraktion via `@mozilla/readability` + `jsdom`
- Automatisch vor Klassifizierung wenn `enrichment_enabled_global=true` und Beschreibung < `enrichment_min_description_chars` Zeichen
- Manuell: Button in Review-Detailansicht, Retry bei `failed`/`pending`
- API: `POST /api/enrich/[id]`

### Lifecycle-Management *(neu seit 2026-05-04)*
- Service: `src/lib/services/lifecycle.service.ts`
- `fresh` → `archived` nach `fresh_ttl_hours` (Default: 48h)
- `archived` → `deleted` nach `archive_retention_days` (Default: 30 Tage)
- Schutzregeln: `keep_approved_forever`, `keep_with_topic_associations`
- Dry-Run Modus verfügbar
- Cron-Trigger: `POST /api/cron/lifecycle?dry_run=true`
- Admin-Seite: `/lifecycle`

### Topic-Verwaltung
- Hierarchischer Baum bis 5 Ebenen
- Fixe Root-Topics: Sport, Natur, Technik, Politik (Trigger schützt sie)
- Topic-Vorschläge: `/topic-suggestions` — annehmen (→ `active`) oder ablehnen (→ `rejected`)
- `topic_status`: `active | suggested | rejected`

### Review-Flow
- Review-Queue (`/review`), Kandidaten verwalten, Bulk-Approve
- Enrichment-Status in Detailansicht sichtbar

### Admin-UI
- Dashboard, KI-Logs, Schema-Viewer, Import/Export
- Sidebar: Übersicht / Inhalte / KI / System

---

## Supabase-Setup

### Migrationen
Alle Migrationen in `supabase/migrations/` wurden ausgeführt:
- `000–008`: Basistabellen (topics, rss_feeds, incoming_items, KI-Tabellen, Views)
- `010–015`: Lifecycle, Enrichment, Topic-Suggestions, erweiterte Settings

Für Neuinstallation: `20260501_010_015_COMBINED.sql` ausführen (nach 001–008).

### Wichtige Tabellen
| Tabelle | Zweck |
|---|---|
| `topics` | Topic-Baum mit `topic_status`, `proposed_by_llm` |
| `incoming_items` | RSS-Items mit `lifecycle_state`, `enrichment_status`, `enriched_content` |
| `incoming_item_topics` | Kandidaten-Zuordnungen mit `confidence`, `is_primary`, `status` |
| `classifier_settings` | Singleton-Config (temperature, num_ctx, enrichment, lifecycle …) |
| `classification_runs` | KI-Logs mit Raw-Response |
| `enrichment_cache` | URL → extrahierter Volltext, gecacht |
| `lifecycle_runs` | Audit-Log für Archivierungs-Runs |

### Views
| View | Zweck |
|---|---|
| `topics_with_path` | Topics mit `full_path` und `path_array`, inkl. `topic_status` |
| `dashboard_stats` | Kennzahlen für Dashboard |
| `pending_topic_suggestions` | Topics mit `topic_status='suggested'` |
| `low_confidence_items` | Items unter Konfidenz-Schwelle |
| `recent_classifications` | Letzte KI-Runs |
| `items_per_root` | Item-Anzahl pro Root-Topic |

---

## Lokales Setup

```powershell
# Ollama starten (falls nicht läuft)
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
  num_predict = 400,
  timeout_ms = 360000;
```

---

## Wichtige Dateien

| Datei | Zweck |
|---|---|
| `src/lib/services/classifier.service.ts` | Zweistufige KI-Klassifizierung, `classifyItem()`, `getSettings()` |
| `src/lib/services/enrichment.service.ts` | Volltext-Extraktion, cache-first |
| `src/lib/services/lifecycle.service.ts` | Archivierung/Löschung nach TTL |
| `src/lib/services/feed.service.ts` | RSS-Fetch und Parsing |
| `src/lib/prompts/classifier-prompt.ts` | Prompt-Builder, numerischer Index, nutzt `content` |
| `src/lib/validators/classifier.schema.ts` | Zod-Schemas (compactResponseSchema) |
| `src/lib/services/ollama.client.ts` | HTTP-Wrapper, `think: false`, konfigurierbare Parameter |
| `src/lib/types/database.types.ts` | Alle DB-Typen (manuell gepflegt, nicht auto-generiert) |
| `src/app/(admin)/review/page.tsx` | Review-Queue (Client Component) |
| `src/app/api/cron/fetch-feeds/route.ts` | RSS-Cron-Trigger |
| `src/app/api/cron/lifecycle/route.ts` | Lifecycle-Cron-Trigger |

---

## Bekannte Eigenheiten

- `@supabase/supabase-js` gepinnt auf `2.43.4` (neuere Versionen brechen Types)
- `classifier_settings` PATCH braucht `@ts-ignore` (Supabase v2 never-Type-Bug)
- Ollama serialisiert Requests (CPU-only) → kein paralleler Batch möglich
- `database.types.ts` wird manuell gepflegt (kein `npm run db:types` wegen Supabase-Remote-Config)
- `enrichment_cache.byte_length` ist `GENERATED ALWAYS AS` in DB → wird **nicht** im Insert gesetzt

---

## Was als nächstes sinnvoll wäre

- [ ] **LLM Topic-Vorschläge:** Classifier erweitern damit er neue Sub-Topics vorschlägt wenn kein guter Match existiert (nutzt `match_topic_by_name()` RPC und `proposed_by_llm=true`)
- [ ] **Reclassify on Update:** `reclassify_on_update`-Setting implementieren — Items neu klassifizieren wenn Feed-Update kommt
- [ ] **Enrichment-Settings in UI:** `enrichment_min_description_chars`, `enrichment_max_chars`, `enrichment_fetch_timeout_ms` in `/settings/classifier` anzeigen
- [ ] **Windows Task Scheduler:** Lifecycle-Cron eintragen (`POST /api/cron/lifecycle`)
- [ ] **Prompt-Template aus DB:** `prompt_template`-Feld in `classifier_settings` nutzen statt hardcoded Prompt
