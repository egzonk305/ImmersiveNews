# Enrichment, Lifecycle & Topic-Suggestions – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Content-Enrichment (Volltext-Extraktion), konfigurierbare Classifier-Settings aus DB, Lifecycle-Management (Archivierung) und Topic-Suggestions-UI implementieren.

**Architecture:** Vier unabhängige Subsysteme, die aufeinander aufbauen: (1) Settings aus DB im Classifier, (2) Enrichment-Service für Volltext, (3) Lifecycle-Service für Archivierung, (4) UI für Topic-Vorschläge. Alle Services nutzen den Supabase-Client und lesen Konfiguration aus `classifier_settings`.

**Tech Stack:** Next.js 15 API Routes, Supabase, `@mozilla/readability` + `jsdom` für Enrichment, TypeScript strict.

---

## Subsystem-Überblick

| # | Subsystem | Dateien | Commit |
|---|-----------|---------|--------|
| 0 | Uncommitted Änderungen einchecken | — | `chore: DB-Typen, Pakete, konfigurierbare Ollama-Parameter` |
| 1 | Settings aus DB im Classifier | `classifier.service.ts`, `classifier-prompt.ts` | `feat: Classifier liest temperature/num_ctx/timeout aus DB` |
| 2 | Enrichment Service | `enrichment.service.ts`, `api/enrich/[id]/route.ts`, Review-UI | `feat: Content-Enrichment via Readability` |
| 3 | Lifecycle Service | `lifecycle.service.ts`, `api/cron/lifecycle/route.ts`, Admin-Seite | `feat: Lifecycle-Management (Archivierung/Löschung)` |
| 4 | Topic-Suggestions UI | `api/topic-suggestions/route.ts`, Admin-Seite | `feat: Topic-Vorschläge Review-UI` |

---

## Task 0: Uncommitted Änderungen committen

**Files:**
- Modify: `.claude/settings.local.json`
- Modify: `package.json` + `package-lock.json`
- Modify: `src/lib/services/ollama.client.ts`
- Modify: `src/lib/types/database.types.ts`

- [ ] **Step 1: Änderungen stagen und committen**

```bash
git add src/lib/types/database.types.ts src/lib/services/ollama.client.ts package.json package-lock.json .claude/settings.local.json
git commit -m "chore: DB-Typen für Lifecycle/Enrichment, Pakete, konfigurierbare Ollama-Parameter"
```

---

## Task 1: Classifier liest Settings aus DB

Der `runStage()`-Aufruf in `classifier.service.ts` hardcodet `temperature: 0.1` und `timeoutMs: 360_000`. Außerdem nutzt der Prompt das `content`-Feld noch nicht (nur title + description). Beides wird hier gefixt.

**Files:**
- Modify: `src/lib/services/classifier.service.ts:95-146`
- Modify: `src/lib/prompts/classifier-prompt.ts`

- [ ] **Step 1: `runStage()` nutzt Settings aus DB**

In `classifier.service.ts`, `runStage()`-Funktion (Zeile 112-119) ersetzen:

```typescript
// vorher:
const result = await generate({
  baseUrl: settings.ollama_base_url,
  model: settings.model_name,
  prompt,
  temperature: 0.1,
  timeoutMs: 360_000,
})

// nachher:
const result = await generate({
  baseUrl: settings.ollama_base_url,
  model: settings.model_name,
  prompt,
  temperature: settings.temperature,
  numCtx: settings.num_ctx,
  numPredict: settings.num_predict,
  timeoutMs: settings.timeout_ms,
})
```

- [ ] **Step 2: Prompt nutzt `content` wenn vorhanden**

In `src/lib/prompts/classifier-prompt.ts`, `buildClassifierPrompt()` den Inhalt-Block erweitern:

```typescript
// vorher:
const description = (opts.item.description ?? '').slice(0, 300)

const prompt = `Klassifiziere den Artikel. Wähle maximal ${opts.maxCandidates} Themen-Nummern aus der Liste. Genau einer hat is_primary:true.

THEMEN:
${topicsList}

ARTIKEL:
Titel: ${opts.item.title}
Beschreibung: ${description || '(keine)'}

Antworte NUR mit diesem JSON-Objekt, keine Erklärung, kein Markdown:
{"candidates":[{"n":NUMMER,"confidence":0.0-1.0,"is_primary":true/false}]}`

// nachher:
const description = (opts.item.description ?? '').slice(0, 300)
const content = opts.item.content ? opts.item.content.slice(0, 800) : null

const artikelBlock = [
  `Titel: ${opts.item.title}`,
  `Beschreibung: ${description || '(keine)'}`,
  content ? `Volltext (Auszug): ${content}` : null,
].filter(Boolean).join('\n')

const prompt = `Klassifiziere den Artikel. Wähle maximal ${opts.maxCandidates} Themen-Nummern aus der Liste. Genau einer hat is_primary:true.

THEMEN:
${topicsList}

ARTIKEL:
${artikelBlock}

Antworte NUR mit diesem JSON-Objekt, keine Erklärung, kein Markdown:
{"candidates":[{"n":NUMMER,"confidence":0.0-1.0,"is_primary":true/false}]}`
```

- [ ] **Step 3: Manuell testen**

Dev-Server starten (`npm run dev`), ein Item klassifizieren, in den Classification-Logs prüfen ob der Prompt jetzt den Volltext-Auszug enthält. Settings-Seite (`/settings/classifier`) aufrufen und prüfen ob temperature/num_ctx/num_predict sichtbar sind (werden in Task 1-Step 4 hinzugefügt).

- [ ] **Step 4: Settings-UI um neue Felder erweitern**

In `src/app/(admin)/settings/classifier/page.tsx` (oder die zugehörige Client-Komponente) die neuen Felder hinzufügen. Zuerst die Datei lesen, dann diese Felder nach dem existierenden `auto_accept_enabled`-Feld einfügen:

```tsx
// Neue Felder in der Settings-Form (nach auto_accept_enabled):
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="text-sm font-medium">Temperature</label>
    <input type="number" step="0.05" min="0" max="1"
      {...register('temperature', { valueAsNumber: true })} />
  </div>
  <div>
    <label className="text-sm font-medium">Context (num_ctx)</label>
    <input type="number" step="512" min="2048" max="32768"
      {...register('num_ctx', { valueAsNumber: true })} />
  </div>
  <div>
    <label className="text-sm font-medium">Max Tokens (num_predict)</label>
    <input type="number" step="50" min="100" max="2000"
      {...register('num_predict', { valueAsNumber: true })} />
  </div>
  <div>
    <label className="text-sm font-medium">Timeout (ms)</label>
    <input type="number" step="30000" min="30000" max="600000"
      {...register('timeout_ms', { valueAsNumber: true })} />
  </div>
</div>
```

Wichtig: Die API-Route `src/app/api/classifier-settings/route.ts` lesen — sie muss die neuen Felder beim PATCH durchlassen. Falls nicht, dort `temperature, num_ctx, num_predict, timeout_ms` in das Update-Objekt aufnehmen.

- [ ] **Step 5: Committen**

```bash
git add src/lib/services/classifier.service.ts src/lib/prompts/classifier-prompt.ts src/app/api/classifier-settings/route.ts src/app/(admin)/settings/classifier/
git commit -m "feat: Classifier liest temperature/num_ctx/num_predict/timeout aus DB-Settings, Prompt nutzt content"
```

---

## Task 2: Enrichment Service

Fetch-Volltext aus Artikel-URL, extrahiere mit Readability, cache in `enrichment_cache`, integriere in Klassifizierung.

**Files:**
- Create: `src/lib/services/enrichment.service.ts`
- Create: `src/app/api/enrich/[id]/route.ts`
- Modify: `src/lib/services/classifier.service.ts` (Enrichment vor Klassifizierung aufrufen)

- [ ] **Step 1: Enrichment Service erstellen**

Datei `src/lib/services/enrichment.service.ts` erstellen:

```typescript
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ClassifierSettings } from '@/lib/types/database.types'

async function fetchAndExtract(url: string, timeoutMs: number): Promise<string | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ImmersiveNews/1.0' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const html = await response.text()
  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()
  return article?.textContent?.replace(/\s+/g, ' ').trim() ?? null
}

export async function enrichItem(
  supabase: SupabaseClient<Database>,
  itemId: string,
  sourceUrl: string,
  settings: ClassifierSettings
): Promise<string | null> {
  // Cache prüfen
  const { data: cached } = await supabase
    .from('enrichment_cache')
    .select('content, status')
    .eq('url', sourceUrl)
    .maybeSingle()

  if (cached?.status === 'success' && cached.content) {
    const truncated = cached.content.slice(0, settings.enrichment_max_chars)
    await supabase
      .from('incoming_items')
      .update({
        enrichment_status: 'success',
        enriched_content: truncated,
        enriched_at: new Date().toISOString(),
      })
      .eq('id', itemId)
    return truncated
  }

  await supabase
    .from('incoming_items')
    .update({ enrichment_status: 'pending' })
    .eq('id', itemId)

  try {
    const raw = await fetchAndExtract(sourceUrl, settings.enrichment_fetch_timeout_ms)
    const truncated = raw ? raw.slice(0, settings.enrichment_max_chars) : null

    await supabase.from('enrichment_cache').upsert(
      {
        url: sourceUrl,
        fetched_at: new Date().toISOString(),
        content: truncated,
        status: truncated ? 'success' : 'failed',
        error: truncated ? null : 'Kein Inhalt extrahiert',
      },
      { onConflict: 'url' }
    )

    await supabase
      .from('incoming_items')
      .update({
        enrichment_status: truncated ? 'success' : 'failed',
        enriched_content: truncated,
        enrichment_error: truncated ? null : 'Kein Inhalt extrahiert',
        enriched_at: new Date().toISOString(),
      })
      .eq('id', itemId)

    return truncated
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('enrichment_cache').upsert(
      { url: sourceUrl, fetched_at: new Date().toISOString(), content: null, status: 'failed', error: msg },
      { onConflict: 'url' }
    )
    await supabase
      .from('incoming_items')
      .update({ enrichment_status: 'failed', enrichment_error: msg })
      .eq('id', itemId)
    return null
  }
}
```

- [ ] **Step 2: Enrichment in `classifyItem()` integrieren**

In `classifier.service.ts`, nach dem Laden des Items (nach Zeile 168, vor `const itemForPrompt`):

```typescript
// Enrichment: wenn global enabled und Item hat URL, Volltext holen
let enrichedContent: string | null = item.enriched_content ?? null
if (
  settings.enrichment_enabled_global &&
  item.source_url &&
  item.enrichment_status !== 'success' &&
  (item.description?.length ?? 0) < settings.enrichment_min_description_chars
) {
  try {
    enrichedContent = await enrichItem(supabase, itemId, item.source_url, settings)
  } catch {
    // Klassifizierung trotzdem fortsetzen
  }
}

const itemForPrompt = {
  title: item.title,
  description: item.description,
  content: enrichedContent ?? item.content,
}
```

Import am Dateianfang hinzufügen:
```typescript
import { enrichItem } from '@/lib/services/enrichment.service'
```

- [ ] **Step 3: Manuelle Enrichment-API erstellen**

Datei `src/app/api/enrich/[id]/route.ts` erstellen:

```typescript
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/services/classifier.service'
import { enrichItem } from '@/lib/services/enrichment.service'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('incoming_items')
    .select('id, source_url, enrichment_status')
    .eq('id', id)
    .single()

  if (!item?.source_url) {
    return NextResponse.json({ error: 'Keine URL' }, { status: 400 })
  }

  try {
    const settings = await getSettings(supabase)
    const content = await enrichItem(supabase, id, item.source_url, settings)
    return NextResponse.json({ ok: true, chars: content?.length ?? 0 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4: Enrichment in der Review-UI anzeigen**

Die Review-Detailseite (`src/app/(admin)/review/[id]/page.tsx` oder die zugehörige Komponente) lesen.  
Einen Badge/Status für `enrichment_status` hinzufügen und einen Button "Volltext laden" der `POST /api/enrich/[id]` aufruft.

```tsx
// Beispiel Badge (neben dem Status-Badge):
{item.enrichment_status === 'success' && (
  <span className="text-xs text-green-600">✓ Volltext ({item.enriched_content?.length} Zeichen)</span>
)}
{item.enrichment_status === 'failed' && (
  <span className="text-xs text-red-500">Enrichment fehlgeschlagen</span>
)}
{(!item.enrichment_status || item.enrichment_status === 'none') && item.source_url && (
  <button onClick={() => fetch(`/api/enrich/${item.id}`, { method: 'POST' })
    .then(() => router.refresh())}>
    Volltext laden
  </button>
)}
```

- [ ] **Step 5: Testen**

1. Dev-Server starten
2. Ein Item mit `source_url` öffnen
3. "Volltext laden" klicken, Network-Tab prüfen
4. Seite refreshen, `enriched_content` und `enrichment_status='success'` prüfen
5. Nochmals ein Item klassifizieren (`POST /api/classify/[id]`), in Classification-Logs den Prompt auf Volltext prüfen

- [ ] **Step 6: Committen**

```bash
git add src/lib/services/enrichment.service.ts src/app/api/enrich/ src/lib/services/classifier.service.ts src/app/(admin)/review/
git commit -m "feat: Content-Enrichment via Readability — Volltext in Klassifizierungs-Prompt"
```

---

## Task 3: Lifecycle Service

Items archivieren wenn älter als `fresh_ttl_hours`, löschen wenn älter als `archive_retention_days`. Approved Items mit Topic-Zuordnungen optional behalten.

**Files:**
- Create: `src/lib/services/lifecycle.service.ts`
- Create: `src/app/api/cron/lifecycle/route.ts`
- Create: `src/app/(admin)/lifecycle/page.tsx`
- Modify: `src/app/(admin)/layout.tsx` (Sidebar-Link hinzufügen)

- [ ] **Step 1: Lifecycle Service erstellen**

Datei `src/lib/services/lifecycle.service.ts` erstellen:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, LifecycleRunInsert } from '@/lib/types/database.types'
import { getSettings } from '@/lib/services/classifier.service'

export interface LifecycleResult {
  run_id: string
  archived_count: number
  deleted_count: number
  dry_run: boolean
  error: string | null
}

export async function runLifecycle(
  supabase: SupabaseClient<Database>,
  dryRun = false
): Promise<LifecycleResult> {
  const settings = await getSettings(supabase)
  const now = new Date()

  const freshThreshold = new Date(
    now.getTime() - settings.fresh_ttl_hours * 3_600_000
  ).toISOString()

  const deleteThreshold = new Date(
    now.getTime() - settings.archive_retention_days * 86_400_000
  ).toISOString()

  let archivedCount = 0
  let deletedCount = 0
  let runError: string | null = null

  try {
    // --- Archivieren: fresh → archived ---
    // Items die älter sind als fresh_ttl_hours und noch nicht approved/archived
    let archiveQuery = supabase
      .from('incoming_items')
      .select('id')
      .lt('created_at', freshThreshold)
      .eq('lifecycle_state', 'fresh')
      .in('status', ['pending', 'skipped', 'failed'])

    if (settings.keep_approved_forever) {
      // approved Items nicht archivieren — Filter schon via status above
    }

    const { data: toArchive } = await archiveQuery
    archivedCount = toArchive?.length ?? 0

    if (!dryRun && archivedCount > 0) {
      const ids = toArchive!.map(i => i.id)
      await supabase
        .from('incoming_items')
        .update({
          lifecycle_state: 'archived',
          archived_at: now.toISOString(),
        })
        .in('id', ids)
    }

    // --- Löschen: archived → deleted ---
    // Archived Items die älter als archive_retention_days
    let deleteQuery = supabase
      .from('incoming_items')
      .select('id, target_topic_id')
      .lt('archived_at', deleteThreshold)
      .eq('lifecycle_state', 'archived')

    const { data: toDelete } = await deleteQuery
    let candidatesForDeletion = toDelete ?? []

    if (settings.keep_with_topic_associations) {
      candidatesForDeletion = candidatesForDeletion.filter(i => !i.target_topic_id)
    }
    if (settings.keep_approved_forever) {
      // approved Items haben target_topic_id — schon gefiltert oben
    }

    deletedCount = candidatesForDeletion.length

    if (!dryRun && deletedCount > 0) {
      const ids = candidatesForDeletion.map(i => i.id)
      await supabase
        .from('incoming_items')
        .update({ lifecycle_state: 'deleted' })
        .in('id', ids)
      // Physisch löschen (optional — erst mal nur lifecycle_state setzen)
    }
  } catch (err) {
    runError = err instanceof Error ? err.message : String(err)
  }

  // Run loggen
  const runInsert: LifecycleRunInsert = {
    dry_run: dryRun,
    finished_at: new Date().toISOString(),
    archived_count: archivedCount,
    deleted_count: deletedCount,
    archived_summary: null,
    deleted_summary: null,
    error: runError,
  }

  const { data: runData } = await supabase
    .from('lifecycle_runs')
    .insert(runInsert)
    .select('id')
    .single()

  return {
    run_id: runData?.id ?? '',
    archived_count: archivedCount,
    deleted_count: deletedCount,
    dry_run: dryRun,
    error: runError,
  }
}
```

- [ ] **Step 2: Cron-API-Route erstellen**

Datei `src/app/api/cron/lifecycle/route.ts` erstellen:

```typescript
import { createClient } from '@/lib/supabase/server'
import { runLifecycle } from '@/lib/services/lifecycle.service'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dry_run') === 'true'

  const supabase = await createClient()
  try {
    const result = await runLifecycle(supabase, dryRun)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Admin-Seite für Lifecycle-Runs**

Datei `src/app/(admin)/lifecycle/page.tsx` erstellen:

```tsx
import { createClient } from '@/lib/supabase/server'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

export default async function LifecyclePage() {
  const supabase = await createClient()
  const { data: runs } = await supabase
    .from('lifecycle_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lifecycle-Management</h1>
        <form action="/api/cron/lifecycle" method="POST">
          <button
            type="submit"
            className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
          >
            Jetzt ausführen
          </button>
        </form>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">Zeitpunkt</th>
            <th className="py-2 pr-4">Archiviert</th>
            <th className="py-2 pr-4">Gelöscht</th>
            <th className="py-2 pr-4">Dry-Run</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs?.map(run => (
            <tr key={run.id} className="border-b hover:bg-muted/50">
              <td className="py-2 pr-4">
                {formatDistanceToNow(new Date(run.started_at), { addSuffix: true, locale: de })}
              </td>
              <td className="py-2 pr-4">{run.archived_count}</td>
              <td className="py-2 pr-4">{run.deleted_count}</td>
              <td className="py-2 pr-4">{run.dry_run ? 'Ja' : 'Nein'}</td>
              <td className="py-2">
                {run.error
                  ? <span className="text-red-500">{run.error}</span>
                  : <span className="text-green-600">OK</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Sidebar-Link hinzufügen**

`src/app/(admin)/layout.tsx` oder die Sidebar-Komponente lesen und unter "System" einen Link zu `/lifecycle` hinzufügen:

```tsx
{ href: '/lifecycle', label: 'Lifecycle', icon: Archive }
// Icon aus lucide-react: import { Archive } from 'lucide-react'
```

- [ ] **Step 5: Testen**

1. Dev-Server starten
2. `POST http://localhost:3000/api/cron/lifecycle?dry_run=true` aufrufen (z.B. via Browser-Fetch oder curl)
3. Response prüfen: `{ archived_count, deleted_count, dry_run: true }`
4. `/lifecycle`-Seite öffnen, Run-Eintrag sehen
5. Ohne `dry_run` aufrufen und DB-Einträge prüfen

- [ ] **Step 6: Committen**

```bash
git add src/lib/services/lifecycle.service.ts src/app/api/cron/lifecycle/ src/app/(admin)/lifecycle/ src/app/(admin)/layout.tsx
git commit -m "feat: Lifecycle-Service — Items archivieren/löschen nach konfigurierbaren Schwellwerten"
```

---

## Task 4: Topic-Suggestions UI

Zeigt Topics mit `topic_status='suggested'` aus der `pending_topic_suggestions`-View. Admin kann approved (→ `'active'`) oder reject (→ `'rejected'`).

**Files:**
- Create: `src/app/api/topic-suggestions/route.ts`
- Create: `src/app/api/topic-suggestions/[id]/route.ts`
- Create: `src/app/(admin)/topic-suggestions/page.tsx`
- Modify: Sidebar (Link hinzufügen)

- [ ] **Step 1: List-API erstellen**

Datei `src/app/api/topic-suggestions/route.ts` erstellen:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pending_topic_suggestions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Approve/Reject-API erstellen**

Datei `src/app/api/topic-suggestions/[id]/route.ts` erstellen:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({
  action: z.enum(['approve', 'reject']),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Ungültig' }, { status: 400 })

  const supabase = await createClient()
  const newStatus = body.data.action === 'approve' ? 'active' : 'rejected'

  const { error } = await supabase
    .from('topics')
    .update({ topic_status: newStatus })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, topic_status: newStatus })
}
```

- [ ] **Step 3: Admin-Seite erstellen**

Datei `src/app/(admin)/topic-suggestions/page.tsx` erstellen:

```tsx
'use client'
import { useEffect, useState } from 'react'
import type { PendingTopicSuggestion } from '@/lib/types/database.types'
import { useRouter } from 'next/navigation'

export default function TopicSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<PendingTopicSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/topic-suggestions')
      .then(r => r.json())
      .then(setSuggestions)
      .finally(() => setLoading(false))
  }, [])

  async function handleAction(id: string, action: 'approve' | 'reject') {
    await fetch(`/api/topic-suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setSuggestions(prev => prev.filter(s => s.id !== id))
  }

  if (loading) return <div className="p-6">Laden…</div>

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Topic-Vorschläge</h1>
      {suggestions.length === 0 && (
        <p className="text-muted-foreground">Keine offenen Vorschläge.</p>
      )}
      <div className="space-y-3">
        {suggestions.map(s => (
          <div key={s.id} className="border rounded-lg p-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium">{s.name}</p>
              {s.parent_full_path && (
                <p className="text-sm text-muted-foreground">unter: {s.parent_full_path}</p>
              )}
              {s.proposed_from_item_title && (
                <p className="text-xs text-muted-foreground">
                  vorgeschlagen für: {s.proposed_from_item_title}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleAction(s.id, 'approve')}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Annehmen
              </button>
              <button
                onClick={() => handleAction(s.id, 'reject')}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Ablehnen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Sidebar-Link hinzufügen**

In der Sidebar-Komponente unter "KI" einen Link einfügen:

```tsx
{ href: '/topic-suggestions', label: 'Topic-Vorschläge', icon: Lightbulb }
// import { Lightbulb } from 'lucide-react'
```

- [ ] **Step 5: Testen**

1. Dev-Server starten
2. Manuell ein Topic mit `topic_status='suggested'` in Supabase erstellen (oder via SQL: `UPDATE topics SET topic_status='suggested' WHERE id='...'`)
3. `/topic-suggestions` öffnen
4. "Annehmen" klicken, prüfen dass Topic verschwindet und `topic_status='active'` in DB gesetzt wurde
5. Nochmal mit "Ablehnen" prüfen

- [ ] **Step 6: Committen**

```bash
git add src/app/api/topic-suggestions/ src/app/(admin)/topic-suggestions/ src/app/(admin)/layout.tsx
git commit -m "feat: Topic-Vorschläge Review-UI — vorgeschlagene Topics annehmen oder ablehnen"
```

---

## Abschluss-Checkliste

- [ ] Alle 4 Subsysteme committed und getestet
- [ ] `/settings/classifier` zeigt temperature/num_ctx/num_predict/timeout_ms
- [ ] Enrichment: Badge in Review-UI sichtbar, Volltext landet im Klassifizierungs-Prompt
- [ ] Lifecycle: `/lifecycle` zeigt Runs, `POST /api/cron/lifecycle` funktioniert
- [ ] Topic-Suggestions: `/topic-suggestions` zeigt und verwaltet vorgeschlagene Topics
- [ ] Branch mergen oder PR erstellen
