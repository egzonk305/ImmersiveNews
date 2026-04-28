# ImmersiveNews — Projektstatus

**Stand:** 2026-04-29  
**Branch:** `wip/rss-ki-klassifizierung`

---

## Was funktioniert

- **RSS-Feed-Verwaltung** — Feeds hinzufügen, manuell fetchen, Duplikat-Erkennung
- **Admin-UI komplett** — Dashboard, Review-Queue, Topics (Baum + Tabelle), Classifier-Settings, Klassifizierungs-Logs, Import/Export, Schema-Viewer
- **KI-Klassifizierung (Einzelitem)** — funktioniert mit qwen3:1.7b, ~20-40s pro Item
- **Bulk-Klassifizierung** — Fortschrittsbalken mit Stopp-Button, verarbeitet Items einzeln
- **Auto-Accept** — wenn Konfidenz ≥ threshold wird Item automatisch genehmigt

## Aktuell in Arbeit

**Problem:** qwen3:1.7b geht manchmal in Thinking-Mode → sehr lange Antworten  
**Lösungsansatz:** Prompt endet mit `{"candidates":[` (JSON-Priming), `<think>`-Blöcke werden herausgefiltert, `num_predict: 400`, `think: false`  
**Status:** Letzter Test: Parse-Fehler wegen abgeschnittenem `<think>`-Block → Fix committed, noch nicht getestet

## Setup-Requirements

### Supabase
- Alle 9 Migrationen in `supabase/migrations/` ausgeführt
- In `classifier_settings` Tabelle:
  ```sql
  UPDATE classifier_settings SET model_name = 'qwen3:1.7b', max_depth = 3;
  ```

### Ollama
```powershell
ollama serve          # Ollama starten (läuft schon wenn Port belegt)
ollama pull qwen3:1.7b
```

### Next.js
```powershell
npm run dev
```

## Technische Details

### KI-Pipeline
- **Prompt:** Endet mit `{"candidates":[` damit Modell direkt JSON produziert
- **Schema:** Kompaktes Format — Modell gibt Nummern (1-N) statt UUIDs zurück
- **Mapping:** `indexMap` in `classifier-prompt.ts` → Nummern werden zurück zu UUIDs gemappt
- **Ollama-Optionen:** `num_ctx: 8192`, `num_predict: 400`, `think: false`, `timeout: 6min`

### Wichtige Dateien
| Datei | Zweck |
|---|---|
| `src/lib/services/classifier.service.ts` | KI-Klassifizierung Hauptlogik |
| `src/lib/prompts/classifier-prompt.ts` | Prompt-Builder mit numerischem Index-System |
| `src/lib/validators/classifier.schema.ts` | Zod-Schemas (compact + full) |
| `src/lib/services/ollama.client.ts` | HTTP-Wrapper für Ollama API |
| `src/app/(admin)/review/page.tsx` | Review-Queue mit Bulk-Klassifizierung |
| `src/app/api/classify/batch/route.ts` | Batch-Klassifizierung API |

### Bekannte Quirks
- `@supabase/supabase-js` ist auf `2.43.4` gepinnt (neuere Versionen brechen Types mit `@supabase/ssr@0.4.1`)
- `classifier_settings` Insert/Update braucht `@ts-ignore` (alle Felder optional → never-Type-Bug in Supabase v2)
- Ollama `think: false` wird in v0.21.2 möglicherweise ignoriert → Workaround: JSON-Priming + `<think>`-Strip

## Datenfluss
```
RSS-Feed → incoming_items (processing_state: pending)
         → KI → incoming_item_topics (status: suggested)
         → Admin bestätigt → status: confirmed, processing_state: done
```

## Für das Frontend-Team
Siehe `docs/frontend-data-guide.md` — Supabase-Queries, Tabellenstruktur, Beispielcode
