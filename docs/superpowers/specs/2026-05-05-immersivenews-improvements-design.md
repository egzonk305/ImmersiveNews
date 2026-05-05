# ImmersiveNews — Verbesserungen: Cleanup, Baum-Redesign, Performance

**Datum:** 2026-05-05  
**Status:** Genehmigt  
**Priorität:** Impact-first (Cleanup → Baum → Performance)

---

## Kontext

ImmersiveNews ist ein lokales Next.js 15 Admin-Tool zum Verwalten einer 5-stufigen Topic-Hierarchie und zum Klassifizieren von RSS-Artikeln via Ollama/Qwen. Die drei identifizierten Problembereiche:

1. Keine UI zum Bereinigen von alten pending-Artikeln, fehlgeschlagenen Logs und Cache-Einträgen
2. Topic-Baumstruktur visuell veraltet, funktional träge (N+1 API-Calls beim Aufklappen)
3. Batch-Klassifizierung läuft sequentiell, kein Parallelismus

---

## 1. Cleanup-Dashboard (`/admin/cleanup`)

### Ziel
Neue Admin-Seite mit strukturierten Bereinigungsaktionen. Jede Aktion zeigt zuerst eine Vorschau (Anzahl betroffener Einträge), dann einen Bestätigungs-Dialog, dann wird die Aktion ausgeführt.

### Bereiche

#### 1.1 Pending-Artikel bereinigen
- **Vorschau:** Zählt `incoming_items` mit `status IN ('pending', 'failed')` und `created_at < NOW() - INTERVAL 'X days'`
- **Filter:** Alter in Tagen (Default: 7), optional "nur ohne Topic-Zuordnung" (`target_topic_id IS NULL`)
- **Aktionen:**
  - "Alle ablehnen" → setzt `status = 'rejected'` (Items bleiben in DB, verschwinden aus Review-Queue)
  - "Alle löschen" → Hard-Delete aus `incoming_items` (cascaded auf `incoming_item_topics`)

#### 1.2 Klassifizierungs-Logs bereinigen
- **Vorschau:** Zählt `classification_runs` mit `created_at < NOW() - INTERVAL 'X days'`, optional gefiltert auf `status IN ('failed', 'parse_error')`
- **Filter:** Alter in Tagen (Default: 14), Status-Filter (Alle / Nur fehlgeschlagene)
- **Aktion:** Hard-Delete aus `classification_runs`; danach verwaiste `classifier_prompts` löschen (kein `classification_runs`-Eintrag mehr referenziert sie)

#### 1.3 Enrichment-Cache leeren
- **Vorschau:** Zählt alle Einträge in `enrichment_cache`, zeigt geschätzte Größe (Anzahl × Avg-Bytes)
- **Aktionen:**
  - "Alle leeren" → `DELETE FROM enrichment_cache`
  - "Nur fehlgeschlagene leeren" → `DELETE FROM enrichment_cache WHERE status = 'failed'`

#### 1.4 Abgelehnte Topics bereinigen
- **Vorschau:** Zählt `topics` mit `topic_status = 'rejected'` die nicht von `incoming_items.target_topic_id` referenziert werden
- **Aktion:** Löscht diese Topics (safe, da keine Item-Referenzen)

#### 1.5 Lifecycle-Log-Historie kürzen
- **Vorschau:** Zählt `lifecycle_runs` älter als X Tage
- **Filter:** Alter in Tagen (Default: 30)
- **Aktion:** Hard-Delete alter `lifecycle_runs`-Einträge

### API-Endpunkte

| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/cleanup/preview` | Liefert alle 5 Zählungen auf einmal (ein DB-Round-trip) |
| DELETE | `/api/cleanup/pending-items` | Body: `{ olderThanDays, action: 'reject'\|'delete', onlyWithoutTopic }` |
| DELETE | `/api/cleanup/classification-logs` | Body: `{ olderThanDays, statusFilter: 'all'\|'failed_only' }` |
| DELETE | `/api/cleanup/enrichment-cache` | Body: `{ scope: 'all'\|'failed_only' }` |
| DELETE | `/api/cleanup/rejected-topics` | Keine Parameter nötig |
| DELETE | `/api/cleanup/lifecycle-logs` | Body: `{ olderThanDays }` |

### UI-Struktur
- Jeder Bereich = eine Card mit: Titel, Beschreibung, Vorschau-Zahl (Badge), Parameter-Inputs, Aktions-Button(s)
- Vorschau-Zahlen werden beim Seitenaufruf geladen und nach jeder Aktion aktualisiert
- Bestätigungs-Dialog zeigt genau was gelöscht/geändert wird
- Sidebar-Link: "Aufräumen" mit Warn-Icon, zwischen Lifecycle und Schema

---

## 2. Baum-Redesign (TopicTreeBrowser)

### Ziel
Visuell modernisierter, funktional schnellerer Topic-Baum der den gesamten State in einem API-Call lädt und UX-Verbesserungen mitbringt.

### Visuell
- **Verbindungslinien:** Vertikale Linie entlang der Tiefe, horizontale Linie vor jedem Kind-Node (klassischer Dateibaum-Look mit `border-l` + `border-t` in Tailwind)
- **Icons:** Chevron-Icons (`ChevronRight` / `ChevronDown`) statt `▶/▼`
- **Level-Badges:** Farbige kleine Badges (L1=Blau, L2=Grün, L3=Lila, L4=Orange, L5=Grau)
- **Aktions-Buttons:** Edit + Delete immer sichtbar (nicht nur on-hover), aber kompakt

### Lade-Strategie
- **Initialer Load:** `/api/topics/tree?depth=2` liefert alle Roots + ihre direkten Kinder (Level 1+2) in einem Call
- **Lazy Load:** Level 3+ werden beim Aufklappen nachgeladen, aber im lokalen State gecacht (kein erneuter Fetch beim zweiten Aufklappen desselben Nodes)
- **Skeleton-Loading:** Placeholder-Zeilen während des Ladens statt leerem Spinner

### UX
- "Alle aufklappen / alle einklappen" Button in der Toolbar
- Inline-Rename bleibt (Doppelklick), aber auch expliziter Edit-Button
- Neues Subtopic inline anlegen: Klick auf `+` öffnet ein Inline-Input-Feld direkt als Kind-Node (kein Seitenwechsel)
- Kein Drag & Drop (zu komplex, kein klarer Nutzen)

### API-Änderung
- `GET /api/topics/tree` erhält optionalen Query-Parameter `depth` (Default: 1, neu: 2 beim initialen Baum-Load)
- Bestehende Struktur (`TreeNode[]` mit `children`) bleibt kompatibel

### Betroffene Dateien
- `src/components/topics/TopicTreeBrowser.tsx` — kompletter Rewrite der Render-Logik
- `src/app/api/topics/tree/route.ts` — `depth`-Parameter hinzufügen
- `src/app/(admin)/topics/page.tsx` — initiales `depth=2` beim Fetch mitgeben

---

## 3. Performance

### 3.1 Batch-Klassifizierung parallelisieren

**Problem:** `classifyBatch()` und der "Alle klassifizieren"-Flow laufen sequentiell.

**Lösung:**
- Neue Hilfsfunktion `classifyParallel(ids: string[], concurrency = 3)` in `lib/services/classifier.service.ts`
- Nutzt `Promise.allSettled()` in Batches der Größe `concurrency`
- UI-seitig: Live-Fortschrittsbalken "X / Y klassifiziert (Z fehlgeschlagen)" in der Review-Seite
- "Stop"-Button setzt ein `AbortController`-Signal, das nach dem aktuellen Batch stoppt

**Konfiguration:** `concurrency` erstmal hardcoded auf 3 (Ollama-seitig parallel genug, ohne zu überlasten)

### 3.2 N+1 in getRootTopicsWithCount beheben

**Problem:** `topic.service.ts → getRootTopicsWithCount()` ruft `getChildCount(root.id)` für jede Root einzeln auf.

**Lösung:** Einen einzigen Query mit `GROUP BY parent_id` + `COUNT(*)` statt N einzelne Queries.

```sql
SELECT parent_id, COUNT(*) as child_count
FROM topics
WHERE parent_id IN (root_ids)
GROUP BY parent_id
```

### 3.3 Fehlende Datenbank-Indizes

Drei neue Indizes in einer Migration:

```sql
-- Für paginierte Review-Queries (häufigster Filter)
CREATE INDEX IF NOT EXISTS incoming_items_status_created_idx
  ON incoming_items(status, created_at DESC);

-- Für Batch-Klassifizierung-Queries
CREATE INDEX IF NOT EXISTS incoming_items_processing_state_idx
  ON incoming_items(processing_state);

-- Für FK-JOINs
CREATE INDEX IF NOT EXISTS incoming_items_feed_id_idx
  ON incoming_items(feed_id);
```

### Nicht in Scope
- Dashboard-View materialisieren (Gewinn gering bei aktuellen Datenmengen)
- WebSockets / Real-time Updates
- Drag & Drop im Baum

---

## Implementierungsreihenfolge

1. **Cleanup-Dashboard** — neue Seite + 6 API-Endpunkte, keine bestehenden Dateien gebrochen
2. **Baum-Redesign** — `TopicTreeBrowser.tsx` Rewrite + `depth`-Parameter in Tree-API
3. **Performance** — Parallel-Klassifizierung + N+1-Fix + DB-Indizes

---

## Offene Fragen / Entscheidungen

- Concurrency für Batch-KI: 3 (kann später in `classifier_settings` konfigurierbar gemacht werden)
- Cleanup-Bestätigung: einfacher `window.confirm()` oder modaler Dialog → **modaler Dialog** (konsistenter mit der restlichen UI)
- Inline-Topic-Anlage im Baum: API-Call sofort oder erst bei Bestätigung → **sofort beim Enter/Blur**
