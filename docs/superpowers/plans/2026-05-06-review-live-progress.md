# Review-Queue: KI-Pfade + Live-Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** KI-Pfade in der Review-Queue sichtbar machen, Bulk-Classify mit Live-Fortschritt (client-seitig sequenziell), "Ausgewählte klassifizieren"-Button, Single-Classify Inline-Ergebnis.

**Architecture:** Alle Änderungen in `src/app/(admin)/review/page.tsx` (Client Component). Keine neuen API-Routen nötig — pending IDs werden über den bestehenden `/api/review?status=pending&pageSize=500`-Endpoint geholt, danach `/api/classify/[id]` Item für Item (2 parallel). `ai_paths: Json | null` ist ein Array von Arrays (`string[][]`), das erste Element ist der primäre Pfad.

**Tech Stack:** Next.js 15, React, TypeScript, TailwindCSS

---

### Task 1: KI-Pfade anzeigen (blaue Box + expanded Detail)

**Files:**
- Modify: `src/app/(admin)/review/page.tsx`

- [ ] **Schritt 1: Hilfsfunktion für Pfad-Rendering hinzufügen**

  Direkt vor `export default function ReviewPage()` einfügen:

  ```tsx
  function AiPathBreadcrumb({ paths }: { paths: Json | null }) {
    const first = Array.isArray(paths) && Array.isArray(paths[0]) ? (paths[0] as string[]) : null
    if (!first || first.length === 0) return null
    return (
      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
        {first.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-purple-300 text-[10px]">›</span>}
            <span className="rounded bg-purple-50 border border-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700 font-medium">{seg}</span>
          </span>
        ))}
      </div>
    )
  }
  ```

  Dafür muss `Json` aus den types importiert sein. Füge am Anfang der Imports hinzu:
  ```tsx
  import type { IncomingItem, ProcessingState, Json } from '@/lib/types/database.types'
  ```

- [ ] **Schritt 2: `AiPathBreadcrumb` in der blauen KI-Box einbauen**

  In der Item-Liste, NACH dem `ai_summary_short`-Absatz und VOR dem schließenden `</div>` der blauen Box (Zeile ~458), einfügen:

  ```tsx
  {(item.ai_headline || item.ai_summary_short) && (
    <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
      {item.ai_headline && (
        <p className="text-xs font-medium text-blue-900">{item.ai_headline}</p>
      )}
      {item.ai_description && (
        <p className="mt-1 text-xs text-blue-700">{item.ai_description}</p>
      )}
      {item.ai_summary_short && (
        <p className="mt-1 text-[11px] text-blue-600">{item.ai_summary_short}</p>
      )}
      <AiPathBreadcrumb paths={item.ai_paths ?? null} />
    </div>
  )}
  ```

  Hinweis: `item.ai_paths` ist bereits im `select *` der `/api/review`-Route enthalten.

- [ ] **Schritt 3: Expanded-Detail-Ansicht verbessern**

  Im expanded Block (Zeile ~476) den bestehenden "Klassifizierter Pfad"-Block ersetzen:

  ```tsx
  {/* Vorher: nur item.topics?.name */}
  {(item.ai_paths || item.topics?.name) && (
    <div className="mb-3">
      <p className="mb-1 text-xs font-medium text-gray-600">Klassifizierter Pfad</p>
      {item.ai_paths ? (
        <AiPathBreadcrumb paths={item.ai_paths} />
      ) : (
        <div className="rounded bg-purple-50 border border-purple-100 px-2 py-1.5 text-xs text-purple-800">
          {item.topics?.name}
        </div>
      )}
    </div>
  )}
  ```

- [ ] **Schritt 4: TypeScript-Check**

  ```bash
  cd "C:\Users\egzon\Documents\ImmersiveNews" && npx tsc --noEmit
  ```
  Erwartet: 0 Fehler

- [ ] **Schritt 5: Commit**

  ```
  git add "src/app/(admin)/review/page.tsx"
  git commit -m "feat: KI-Pfade als Breadcrumbs in Review-Queue anzeigen"
  ```

---

### Task 2: Live-Progress Bulk Classify (client-seitig sequenziell)

**Files:**
- Modify: `src/app/(admin)/review/page.tsx`

- [ ] **Schritt 1: State für Fehler-Liste hinzufügen**

  Nach `const bulkStopRef = useRef(false)` einfügen:

  ```tsx
  const [bulkErrors, setBulkErrors] = useState<{ id: string; title: string; error: string }[]>([])
  ```

- [ ] **Schritt 2: `handleClassifyAll` komplett ersetzen**

  Die bestehende `handleClassifyAll`-Funktion (Zeilen ~178–215) vollständig durch folgende ersetzen:

  ```tsx
  const handleClassifyAll = async () => {
    if (!confirm('Alle pending Items klassifizieren?')) return
    setError(null); setInfo(null); setBulkErrors([])
    setBulkClassifying(true)
    bulkStopRef.current = false

    try {
      // 1. Alle pending IDs holen
      const idsRes = await fetch(`/api/review?status=pending&pageSize=500&page=1`)
      const idsJson = await idsRes.json()
      const pendingItems: { id: string; title: string }[] = (idsJson.data ?? []).map(
        (i: { id: string; title: string }) => ({ id: i.id, title: i.title })
      )
      const total = pendingItems.length
      if (total === 0) { setInfo('Keine pending Items vorhanden.'); return }

      setBulkProgress({ current: 0, total, success: 0, failed: 0 })

      let success = 0
      let failed = 0
      const errors: { id: string; title: string; error: string }[] = []
      const concurrency = 2

      for (let i = 0; i < total; i += concurrency) {
        if (bulkStopRef.current) break
        const chunk = pendingItems.slice(i, i + concurrency)

        await Promise.allSettled(
          chunk.map(async (item) => {
            try {
              const res = await fetch(`/api/classify/${item.id}`, { method: 'POST' })
              const json = await res.json()
              if (res.ok && json.data?.status === 'success') {
                success++
              } else {
                failed++
                errors.push({ id: item.id, title: item.title, error: json.data?.error ?? json.error ?? 'Unbekannter Fehler' })
              }
            } catch (e) {
              failed++
              errors.push({ id: item.id, title: item.title, error: e instanceof Error ? e.message : 'Netzwerkfehler' })
            }
          })
        )

        setBulkProgress({ current: Math.min(i + concurrency, total), total, success, failed })
      }

      setBulkErrors(errors)
      setInfo(
        `${success} erfolgreich, ${failed} fehlgeschlagen von ${total} Items.`
      )
      loadItems(); loadStats()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler bei Batch-Klassifizierung')
    } finally {
      setBulkProgress(null)
      setBulkClassifying(false)
    }
  }
  ```

- [ ] **Schritt 3: `stopBulkClassify` vereinfachen (kein AbortController mehr nötig)**

  ```tsx
  const stopBulkClassify = () => {
    bulkStopRef.current = true
  }
  ```

  Den `abortControllerRef` und `const controller = new AbortController()` können entfernt werden da die Loop-Logik jetzt client-seitig ist.

- [ ] **Schritt 4: Progress-Anzeige mit % erweitern**

  Den bestehenden Fortschritts-Block (~Zeilen 290–314) so anpassen:

  ```tsx
  {bulkClassifying && bulkProgress && (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-blue-700 font-medium">
          Klassifiziere… {bulkProgress.current} / {bulkProgress.total}
          {' '}
          <span className="text-blue-500 font-semibold">
            ({bulkProgress.total > 0 ? Math.round((bulkProgress.current / bulkProgress.total) * 100) : 0}%)
          </span>
        </span>
        <div className="flex items-center gap-3 text-xs text-blue-600">
          <span>✓ {bulkProgress.success}</span>
          <span className="text-red-500">× {bulkProgress.failed}</span>
          <button
            onClick={stopBulkClassify}
            className="rounded border border-blue-300 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100"
          >
            Stop
          </button>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-blue-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }}
        />
      </div>
    </div>
  )}
  ```

- [ ] **Schritt 5: Fehler-Liste nach dem Bulk-Lauf anzeigen**

  Nach dem `{info && ...}` Block einfügen:

  ```tsx
  {bulkErrors.length > 0 && (
    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-red-700">{bulkErrors.length} Items fehlgeschlagen</p>
        <button onClick={() => setBulkErrors([])} className="text-red-400 text-xs">✕</button>
      </div>
      <ul className="space-y-1">
        {bulkErrors.slice(0, 5).map(e => (
          <li key={e.id} className="text-xs text-red-600">
            <span className="font-medium">{e.title.slice(0, 50)}</span>: {e.error}
          </li>
        ))}
        {bulkErrors.length > 5 && (
          <li className="text-xs text-red-400">…und {bulkErrors.length - 5} weitere</li>
        )}
      </ul>
    </div>
  )}
  ```

- [ ] **Schritt 6: `limit`-Input und `bulkLimit`-State entfernen**

  Da wir jetzt alle pending IDs direkt laden, wird der `limit`-Input überflüssig. Entfernen:
  - `const [bulkLimit, setBulkLimit] = useState(200)` State
  - Das `<label>Limit <input ...></label>` aus dem PageHeader action-Bereich

- [ ] **Schritt 7: TypeScript-Check**

  ```bash
  cd "C:\Users\egzon\Documents\ImmersiveNews" && npx tsc --noEmit
  ```
  Erwartet: 0 Fehler

- [ ] **Schritt 8: Commit**

  ```
  git add "src/app/(admin)/review/page.tsx"
  git commit -m "feat: Live-Fortschritt mit % beim Bulk-Klassifizieren"
  ```

---

### Task 3: "Ausgewählte klassifizieren" Button

**Files:**
- Modify: `src/app/(admin)/review/page.tsx`

- [ ] **Schritt 1: `handleClassifySelected` Funktion hinzufügen**

  Nach `handleClassifyAll` einfügen:

  ```tsx
  const handleClassifySelected = async () => {
    if (selected.size === 0) return
    setError(null); setInfo(null); setBulkErrors([])
    setBulkClassifying(true)
    bulkStopRef.current = false

    const selectedItems = items
      .filter(i => selected.has(i.id))
      .map(i => ({ id: i.id, title: i.title }))
    const total = selectedItems.length

    setBulkProgress({ current: 0, total, success: 0, failed: 0 })

    let success = 0
    let failed = 0
    const errors: { id: string; title: string; error: string }[] = []
    const concurrency = 2

    for (let i = 0; i < total; i += concurrency) {
      if (bulkStopRef.current) break
      const chunk = selectedItems.slice(i, i + concurrency)

      await Promise.allSettled(
        chunk.map(async (item) => {
          try {
            const res = await fetch(`/api/classify/${item.id}`, { method: 'POST' })
            const json = await res.json()
            if (res.ok && json.data?.status === 'success') {
              success++
            } else {
              failed++
              errors.push({ id: item.id, title: item.title, error: json.data?.error ?? json.error ?? 'Unbekannter Fehler' })
            }
          } catch (e) {
            failed++
            errors.push({ id: item.id, title: item.title, error: e instanceof Error ? e.message : 'Netzwerkfehler' })
          }
        })
      )

      setBulkProgress({ current: Math.min(i + concurrency, total), total, success, failed })
    }

    setBulkErrors(errors)
    setInfo(`${success} von ${total} ausgewählten Items klassifiziert.`)
    setSelected(new Set())
    loadItems(); loadStats()

    setBulkProgress(null)
    setBulkClassifying(false)
  }
  ```

- [ ] **Schritt 2: Button in die Bulk-Aktionsleiste einbauen**

  In der Bulk-Aktionsleiste (wo `{selected.size > 0 && ...}` ist), den "🧠 Klassifizieren"-Button hinzufügen:

  ```tsx
  {selected.size > 0 && (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500">{selected.size} gewählt:</span>
      <button
        onClick={handleClassifySelected}
        disabled={bulkClassifying}
        className="rounded-md bg-purple-600 px-2.5 py-1 text-xs text-white hover:bg-purple-700 disabled:opacity-50"
      >
        🧠 Klassifizieren
      </button>
      <button onClick={() => handleBulk('approve')} className="rounded-md bg-green-600 px-2.5 py-1 text-xs text-white hover:bg-green-700">✓ Erledigen</button>
      <button onClick={() => handleBulk('reject')} className="rounded-md bg-red-500 px-2.5 py-1 text-xs text-white hover:bg-red-600">✕ Ablehnen</button>
      <button onClick={() => handleBulk('delete')} className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50">Löschen</button>
    </div>
  )}
  ```

- [ ] **Schritt 3: TypeScript-Check**

  ```bash
  cd "C:\Users\egzon\Documents\ImmersiveNews" && npx tsc --noEmit
  ```

- [ ] **Schritt 4: Commit**

  ```
  git add "src/app/(admin)/review/page.tsx"
  git commit -m "feat: Ausgewählte Items direkt klassifizieren"
  ```

---

### Task 4: Single-Classify Inline-Ergebnis

**Files:**
- Modify: `src/app/(admin)/review/page.tsx`

- [ ] **Schritt 1: State für Inline-Ergebnisse hinzufügen**

  Nach `const [classifyingId, setClassifyingId] = useState<string | null>(null)` einfügen:

  ```tsx
  const [classifyResults, setClassifyResults] = useState<Map<string, string[]>>(new Map())
  ```

- [ ] **Schritt 2: `handleClassify` um Pfad-Speicherung erweitern**

  In `handleClassify`, nach dem `setInfo(...)` Block und VOR `loadItems()`:

  ```tsx
  if (res.ok && json.data?.status === 'success') {
    // Pfad aus dem Ergebnis speichern
    const path: string[] = json.data?.path ?? []
    if (path.length > 0) {
      setClassifyResults(prev => new Map(prev).set(id, path))
    }
    setInfo(
      `Klassifiziert: ${path.join(' › ') || 'Pfad unbekannt'}`
    )
    setExpandedId(id)
    loadItems(); loadStats()
  }
  ```

- [ ] **Schritt 3: Inline-Ergebnis in der Item-Row anzeigen**

  Direkt nach dem `{item.processing_error && ...}` Block und VOR `{expandedId === item.id && ...}`:

  ```tsx
  {classifyResults.has(item.id) && (
    <div className="mt-1.5 flex items-center gap-1 flex-wrap">
      <span className="text-[10px] text-green-600 font-medium">✓ Klassifiziert:</span>
      {classifyResults.get(item.id)!.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-purple-300 text-[10px]">›</span>}
          <span className="rounded bg-purple-50 border border-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700 font-medium">{seg}</span>
        </span>
      ))}
    </div>
  )}
  ```

- [ ] **Schritt 4: `classifyResults` bei Filter-Wechsel leeren**

  In `loadItems` (wo `setLoading(true)` steht), am Anfang einfügen:

  ```tsx
  setClassifyResults(new Map())
  ```

- [ ] **Schritt 5: TypeScript-Check**

  ```bash
  cd "C:\Users\egzon\Documents\ImmersiveNews" && npx tsc --noEmit
  ```
  Erwartet: 0 Fehler

- [ ] **Schritt 6: Finaler Commit**

  ```
  git add "src/app/(admin)/review/page.tsx"
  git commit -m "feat: Single-Classify zeigt Pfad-Ergebnis inline an"
  ```

---

## Verifikation

1. KI-Pfade: Review-Queue öffnen → ein klassifiziertes Item mit `ai_paths` suchen → Breadcrumbs erscheinen in der blauen KI-Box
2. Bulk-Progress: "Alle pending klassifizieren" klicken → Balken füllt sich live mit %, Zahlen steigen
3. Stop: Während Bulk läuft → Stop-Button bricht nach dem aktuellen Chunk ab
4. Ausgewählte: 2–3 Items auswählen → "🧠 Klassifizieren" klickt → Progress läuft nur für diese Items
5. Single inline: Ein pending Item klassifizieren → Pfad erscheint sofort unter dem Item-Titel
6. `npx tsc --noEmit` → 0 Fehler
