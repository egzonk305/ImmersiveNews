# ImmersiveNews Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cleanup-Dashboard, modernisierter Topic-Baum und Performance-Optimierungen für ImmersiveNews.

**Architecture:** Drei unabhängige Bereiche: (1) neue `/admin/cleanup`-Seite mit 5 API-Endpunkten für Bulk-Bereinigung, (2) Rewrite von `TopicTreeBrowser.tsx` mit depth=2 Preload und modernem Styling, (3) parallele Batch-Klassifizierung + DB-Indizes + N+1-Fix.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), TypeScript, Tailwind CSS

---

## Aktueller Stand

Gespeichert. Hier der aktuelle Stand zusammengefasst:

**Fertig (Tasks 1–11):**
- Alle 6 Cleanup-API-Routen (`/api/cleanup/*`)
- Cleanup-Dashboard UI (`/admin/cleanup`)
- SQL-Funktion `cleanup_orphaned_prompts`
- Task 5fix: Cleanup-UI zeigt `previewError`; Bestätigungsdialoge nutzen generische Texte
- Task 6: Sidebar-Link "Aufräumen"
- Task 7–8: Baum-Redesign mit `depth=2` API, `TopicTreeBrowser` Rewrite, Inline-Rename und Inline-Kind-Anlage
- Task 9–11: Performance (N+1-Fix, parallele Batch-KI, DB-Indizes)

**Noch offen:** Keine Plan-Tasks mehr offen. Supabase-Migration `20260505_016_performance_indexes.sql` muss noch in der Datenbank angewendet werden, falls das nicht bereits passiert ist.

Validierung: `npm run typecheck` und `npm run build` erfolgreich.

---

## Dateiübersicht

**Neu erstellen:**
- `src/app/api/cleanup/preview/route.ts` — GET: alle 5 Vorschau-Zählungen
- `src/app/api/cleanup/pending-items/route.ts` — DELETE: pending/failed Items ablehnen oder löschen
- `src/app/api/cleanup/classification-logs/route.ts` — DELETE: alte classification_runs
- `src/app/api/cleanup/enrichment-cache/route.ts` — DELETE: enrichment_cache leeren
- `src/app/api/cleanup/rejected-topics/route.ts` — DELETE: abgelehnte Topics
- `src/app/api/cleanup/lifecycle-logs/route.ts` — DELETE: alte lifecycle_runs
- `src/app/(admin)/cleanup/page.tsx` — Cleanup-Dashboard UI
- `supabase/migrations/20260505_016_performance_indexes.sql` — neue DB-Indizes

**Modifizieren:**
- `src/components/layout/Sidebar.tsx` — "Aufräumen"-Link hinzufügen
- `src/components/topics/TopicTreeBrowser.tsx` — kompletter Rewrite
- `src/app/api/topics/tree/route.ts` — `depth`-Parameter hinzufügen
- `src/lib/services/topic.service.ts` — N+1 in `getRootTopicsWithCount` fixen
- `src/lib/services/classifier.service.ts` — `classifyParallel()` hinzufügen
- `src/app/(admin)/review/page.tsx` — parallele Batch-KI + Fortschrittsanzeige

---

## Phase 1 — Cleanup-Dashboard

### Task 1: Preview-API

**Files:**
- Create: `src/app/api/cleanup/preview/route.ts`

- [ ] **Erstelle die Datei**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function GET() {
  try {
    const supabase = await createClient()

    const [
      { count: pendingItems },
      { count: classificationLogs },
      { count: enrichmentCache },
      { count: rejectedTopics },
      { count: lifecycleLogs },
    ] = await Promise.all([
      supabase
        .from('incoming_items')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'failed'])
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('classification_runs')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('enrichment_cache')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('topic_status', 'rejected'),
      supabase
        .from('lifecycle_runs')
        .select('*', { count: 'exact', head: true })
        .lt('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    return NextResponse.json({
      data: {
        pendingItems: pendingItems ?? 0,
        classificationLogs: classificationLogs ?? 0,
        enrichmentCache: enrichmentCache ?? 0,
        rejectedTopics: rejectedTopics ?? 0,
        lifecycleLogs: lifecycleLogs ?? 0,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
```

- [ ] **Teste den Endpoint**

```bash
curl http://localhost:3000/api/cleanup/preview
```

Erwartete Ausgabe: `{"data":{"pendingItems":N,"classificationLogs":N,...}}`

- [ ] **Commit**

```bash
git add src/app/api/cleanup/preview/route.ts
git commit -m "feat: GET /api/cleanup/preview — Vorschau-Zählungen für Cleanup"
```

---

### Task 2: Pending-Items API

**Files:**
- Create: `src/app/api/cleanup/pending-items/route.ts`

- [ ] **Erstelle die Datei**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as {
      olderThanDays: number
      action: 'reject' | 'delete'
      onlyWithoutTopic: boolean
    }
    const { olderThanDays, action, onlyWithoutTopic } = body

    if (!['reject', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
    }

    const supabase = await createClient()
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('incoming_items')
      .select('id', { count: 'exact' })
      .in('status', ['pending', 'failed'])
      .lt('created_at', cutoff)

    if (onlyWithoutTopic) {
      query = query.is('target_topic_id', null)
    }

    const { data: items, error: selectError } = await query
    if (selectError) throw new Error(selectError.message)

    const ids = (items ?? []).map((i: { id: string }) => i.id)
    if (ids.length === 0) {
      return NextResponse.json({ data: { affected: 0 } })
    }

    if (action === 'reject') {
      const { error } = await supabase
        .from('incoming_items')
        .update({ status: 'rejected' })
        .in('id', ids)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from('incoming_items')
        .delete()
        .in('id', ids)
      if (error) throw new Error(error.message)
    }

    return NextResponse.json({ data: { affected: ids.length } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
```

- [ ] **Commit**

```bash
git add src/app/api/cleanup/pending-items/route.ts
git commit -m "feat: DELETE /api/cleanup/pending-items"
```

---

### Task 3: Classification-Logs API

**Files:**
- Create: `src/app/api/cleanup/classification-logs/route.ts`

- [ ] **Erstelle die Datei**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as {
      olderThanDays: number
      statusFilter: 'all' | 'failed_only'
    }
    const { olderThanDays, statusFilter } = body
    const supabase = await createClient()
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('classification_runs')
      .delete()
      .lt('created_at', cutoff)

    if (statusFilter === 'failed_only') {
      query = query.in('status', ['failed', 'parse_error'])
    }

    const { error, count } = await query
    if (error) throw new Error(error.message)

    // Verwaiste classifier_prompts bereinigen
    await supabase.rpc('cleanup_orphaned_prompts').maybeSingle()

    return NextResponse.json({ data: { affected: count ?? 0 } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
```

- [ ] **Erstelle die DB-Funktion für verwaiste Prompts** in einer neuen Migrationsdatei `supabase/migrations/20260505_016_performance_indexes.sql` (wird in Task 13 erweitert):

```sql
-- Verwaiste classifier_prompts löschen
CREATE OR REPLACE FUNCTION cleanup_orphaned_prompts()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM classifier_prompts
  WHERE id NOT IN (
    SELECT DISTINCT prompt_hash
    FROM classification_runs
    WHERE prompt_hash IS NOT NULL
  );
$$;
```

- [ ] **Commit**

```bash
git add src/app/api/cleanup/classification-logs/route.ts supabase/migrations/20260505_016_performance_indexes.sql
git commit -m "feat: DELETE /api/cleanup/classification-logs + cleanup_orphaned_prompts Funktion"
```

---

### Task 4: Enrichment-Cache + Rejected-Topics + Lifecycle-Logs APIs

**Files:**
- Create: `src/app/api/cleanup/enrichment-cache/route.ts`
- Create: `src/app/api/cleanup/rejected-topics/route.ts`
- Create: `src/app/api/cleanup/lifecycle-logs/route.ts`

- [ ] **Erstelle enrichment-cache route**

```typescript
// src/app/api/cleanup/enrichment-cache/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { scope: 'all' | 'failed_only' }
    const supabase = await createClient()

    let query = supabase.from('enrichment_cache').delete().neq('url', '')
    if (body.scope === 'failed_only') {
      query = supabase.from('enrichment_cache').delete().eq('status', 'failed')
    }

    const { error, count } = await query
    if (error) throw new Error(error.message)
    return NextResponse.json({ data: { affected: count ?? 0 } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
```

- [ ] **Erstelle rejected-topics route**

```typescript
// src/app/api/cleanup/rejected-topics/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function DELETE() {
  try {
    const supabase = await createClient()

    // Nur Topics löschen, die nicht von incoming_items referenziert werden
    const { data: referenced } = await supabase
      .from('incoming_items')
      .select('target_topic_id')
      .not('target_topic_id', 'is', null)

    const referencedIds = (referenced ?? [])
      .map((r: { target_topic_id: string | null }) => r.target_topic_id)
      .filter(Boolean) as string[]

    let query = supabase
      .from('topics')
      .delete()
      .eq('topic_status', 'rejected')

    if (referencedIds.length > 0) {
      query = query.not('id', 'in', `(${referencedIds.map(id => `'${id}'`).join(',')})`)
    }

    const { error, count } = await query
    if (error) throw new Error(error.message)
    return NextResponse.json({ data: { affected: count ?? 0 } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
```

- [ ] **Erstelle lifecycle-logs route**

```typescript
// src/app/api/cleanup/lifecycle-logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { olderThanDays: number }
    const supabase = await createClient()
    const cutoff = new Date(Date.now() - body.olderThanDays * 24 * 60 * 60 * 1000).toISOString()

    const { error, count } = await supabase
      .from('lifecycle_runs')
      .delete()
      .lt('started_at', cutoff)

    if (error) throw new Error(error.message)
    return NextResponse.json({ data: { affected: count ?? 0 } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
```

- [ ] **Commit**

```bash
git add src/app/api/cleanup/enrichment-cache/route.ts src/app/api/cleanup/rejected-topics/route.ts src/app/api/cleanup/lifecycle-logs/route.ts
git commit -m "feat: DELETE /api/cleanup/{enrichment-cache,rejected-topics,lifecycle-logs}"
```

---

### Task 5: Cleanup-Dashboard UI

**Files:**
- Create: `src/app/(admin)/cleanup/page.tsx`

- [ ] **Erstelle die Seite**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

interface PreviewData {
  pendingItems: number
  classificationLogs: number
  enrichmentCache: number
  rejectedTopics: number
  lifecycleLogs: number
}

interface ConfirmState {
  title: string
  description: string
  onConfirm: () => Promise<void>
}

function CleanupCard({
  title,
  description,
  count,
  countLabel,
  children,
}: {
  title: string
  description: string
  count: number
  countLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          count > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-500'
        }`}>
          {count} {countLabel}
        </span>
      </div>
      {children}
    </div>
  )
}

export default function CleanupPage() {
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Pending-Items Filter
  const [pendingDays, setPendingDays] = useState(7)
  const [pendingAction, setPendingAction] = useState<'reject' | 'delete'>('reject')
  const [pendingOnlyWithoutTopic, setPendingOnlyWithoutTopic] = useState(false)

  // Log-Filter
  const [logDays, setLogDays] = useState(14)
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'failed_only'>('all')

  // Lifecycle-Filter
  const [lifecycleDays, setLifecycleDays] = useState(30)

  const loadPreview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cleanup/preview')
      const json = await res.json()
      if (res.ok) setPreview(json.data)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPreview() }, [loadPreview])

  const runAction = async (url: string, body: Record<string, unknown>) => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unbekannter Fehler')
      setResult(`${json.data.affected} Einträge bereinigt.`)
      await loadPreview()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
      setConfirm(null)
    }
  }

  const ask = (state: ConfirmState) => {
    setResult(null)
    setError(null)
    setConfirm(state)
  }

  return (
    <div>
      <PageHeader
        title="Aufräumen"
        description="Alte Daten, Logs und Cache-Einträge bereinigen"
        icon="🗑"
      />

      {result && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex justify-between">
          <span>✓ {result}</span>
          <button onClick={() => setResult(null)} className="text-green-400">✕</button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">✕</button>
        </div>
      )}

      {/* Bestätigungs-Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{confirm.title}</h3>
            <p className="text-sm text-gray-600 mb-5">{confirm.description}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={confirm.onConfirm}
                disabled={running}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {running ? 'Läuft…' : 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Pending Items */}
        <CleanupCard
          title="Pending-Artikel bereinigen"
          description="Items mit Status 'Ausstehend' oder 'Fehlgeschlagen' die älter als X Tage sind"
          count={loading ? 0 : (preview?.pendingItems ?? 0)}
          countLabel="Items"
        >
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Älter als
              <input
                type="number"
                min={1}
                max={365}
                value={pendingDays}
                onChange={e => setPendingDays(Number(e.target.value))}
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
              />
              Tage
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={pendingOnlyWithoutTopic}
                onChange={e => setPendingOnlyWithoutTopic(e.target.checked)}
              />
              Nur ohne Topic-Zuordnung
            </label>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => ask({
                  title: 'Artikel ablehnen?',
                  description: `Alle ${preview?.pendingItems ?? 0} betroffenen Items werden auf 'Abgelehnt' gesetzt.`,
                  onConfirm: () => runAction('/api/cleanup/pending-items', { olderThanDays: pendingDays, action: 'reject', onlyWithoutTopic: pendingOnlyWithoutTopic }),
                })}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Ablehnen
              </button>
              <button
                onClick={() => ask({
                  title: 'Artikel löschen?',
                  description: `${preview?.pendingItems ?? 0} Items werden unwiderruflich gelöscht.`,
                  onConfirm: () => runAction('/api/cleanup/pending-items', { olderThanDays: pendingDays, action: 'delete', onlyWithoutTopic: pendingOnlyWithoutTopic }),
                })}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                Löschen
              </button>
            </div>
          </div>
        </CleanupCard>

        {/* Classification Logs */}
        <CleanupCard
          title="KI-Klassifizierungs-Logs bereinigen"
          description="Alte classification_runs Einträge inkl. verwaister Prompts löschen"
          count={loading ? 0 : (preview?.classificationLogs ?? 0)}
          countLabel="Logs"
        >
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Älter als
              <input
                type="number"
                min={1}
                max={365}
                value={logDays}
                onChange={e => setLogDays(Number(e.target.value))}
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
              />
              Tage
            </label>
            <select
              value={logStatusFilter}
              onChange={e => setLogStatusFilter(e.target.value as 'all' | 'failed_only')}
              className="rounded border border-gray-200 px-2 py-1 text-xs"
            >
              <option value="all">Alle Status</option>
              <option value="failed_only">Nur fehlgeschlagene</option>
            </select>
            <button
              onClick={() => ask({
                title: 'KI-Logs löschen?',
                description: `${preview?.classificationLogs ?? 0} Log-Einträge werden unwiderruflich gelöscht.`,
                onConfirm: () => runAction('/api/cleanup/classification-logs', { olderThanDays: logDays, statusFilter: logStatusFilter }),
              })}
              className="ml-auto rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              Löschen
            </button>
          </div>
        </CleanupCard>

        {/* Enrichment Cache */}
        <CleanupCard
          title="Enrichment-Cache leeren"
          description="Gecachte Artikel-Volltexte aus der enrichment_cache Tabelle entfernen"
          count={loading ? 0 : (preview?.enrichmentCache ?? 0)}
          countLabel="Einträge"
        >
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => ask({
                title: 'Nur fehlgeschlagene leeren?',
                description: 'Alle Cache-Einträge mit Status "failed" werden gelöscht.',
                onConfirm: () => runAction('/api/cleanup/enrichment-cache', { scope: 'failed_only' }),
              })}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              Nur fehlgeschlagene
            </button>
            <button
              onClick={() => ask({
                title: 'Gesamten Cache leeren?',
                description: `Alle ${preview?.enrichmentCache ?? 0} Cache-Einträge werden gelöscht. Zukünftige Klassifizierungen holen Inhalte neu.`,
                onConfirm: () => runAction('/api/cleanup/enrichment-cache', { scope: 'all' }),
              })}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              Alle leeren
            </button>
          </div>
        </CleanupCard>

        {/* Rejected Topics */}
        <CleanupCard
          title="Abgelehnte Topics löschen"
          description="Topics mit Status 'Abgelehnt' die nicht von Artikeln referenziert werden"
          count={loading ? 0 : (preview?.rejectedTopics ?? 0)}
          countLabel="Topics"
        >
          <div className="mt-3">
            <button
              onClick={() => ask({
                title: 'Abgelehnte Topics löschen?',
                description: `${preview?.rejectedTopics ?? 0} nicht referenzierte, abgelehnte Topics werden gelöscht.`,
                onConfirm: () => runAction('/api/cleanup/rejected-topics', {}),
              })}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              Löschen
            </button>
          </div>
        </CleanupCard>

        {/* Lifecycle Logs */}
        <CleanupCard
          title="Lifecycle-Log-Historie kürzen"
          description="Alte Lifecycle-Run-Protokolle aus der lifecycle_runs Tabelle entfernen"
          count={loading ? 0 : (preview?.lifecycleLogs ?? 0)}
          countLabel="Einträge"
        >
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Älter als
              <input
                type="number"
                min={1}
                max={365}
                value={lifecycleDays}
                onChange={e => setLifecycleDays(Number(e.target.value))}
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
              />
              Tage
            </label>
            <button
              onClick={() => ask({
                title: 'Lifecycle-Logs löschen?',
                description: `${preview?.lifecycleLogs ?? 0} alte Log-Einträge werden gelöscht.`,
                onConfirm: () => runAction('/api/cleanup/lifecycle-logs', { olderThanDays: lifecycleDays }),
              })}
              className="ml-auto rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              Löschen
            </button>
          </div>
        </CleanupCard>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/(admin)/cleanup/page.tsx
git commit -m "feat: /admin/cleanup — Cleanup-Dashboard UI"
```

---

### Task 6: Sidebar-Link für Cleanup

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Füge den Aufräumen-Link in die System-Gruppe ein** (nach `lifecycle`, vor `schema`):

```typescript
// In navGroups, System-Gruppe:
{
  label: 'System',
  items: [
    { href: '/settings/feeds', label: 'RSS-Feeds', icon: '⟳' },
    { href: '/lifecycle', label: 'Lifecycle', icon: '♻' },
    { href: '/cleanup', label: 'Aufräumen', icon: '🗑' },  // NEU
    { href: '/schema', label: 'Schema', icon: '◈' },
  ],
},
```

- [ ] **Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: Sidebar — Aufräumen-Link hinzugefügt"
```

---

## Phase 2 — Baum-Redesign

### Task 7: Tree-API mit depth=2

**Files:**
- Modify: `src/app/api/topics/tree/route.ts`

- [ ] **Ersetze den gesamten Inhalt der Datei**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

interface TreeNode {
  id: string
  name: string
  level: number
  parent_id: string | null
  topic_status: string
  is_fixed_root: boolean
  children?: TreeNode[]
}

async function buildTree(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string | null,
  depth: number,
  maxDepth: number
): Promise<TreeNode[]> {
  const query = supabase
    .from('topics')
    .select('id, name, level, parent_id, topic_status, is_fixed_root')
    .eq('topic_status', 'active')
    .order('name')

  if (parentId === null) {
    query.is('parent_id', null)
  } else {
    query.eq('parent_id', parentId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const nodes = data ?? []
  if (depth >= maxDepth || nodes.length === 0) return nodes as TreeNode[]

  return Promise.all(
    nodes.map(async (node) => ({
      ...node,
      children: await buildTree(supabase, node.id, depth + 1, maxDepth),
    }))
  ) as Promise<TreeNode[]>
}

export async function GET(req: NextRequest) {
  try {
    const depth = Number(req.nextUrl.searchParams.get('depth') ?? '1')
    const maxDepth = Math.min(Math.max(depth, 1), 5)

    const supabase = await createClient()
    const tree = await buildTree(supabase, null, 1, maxDepth)

    return NextResponse.json({ data: tree })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
```

- [ ] **Teste den Endpoint mit depth=2**

```bash
curl "http://localhost:3000/api/topics/tree?depth=2"
```

Erwartete Ausgabe: JSON mit roots, jedes hat `children: [...]`

- [ ] **Commit**

```bash
git add src/app/api/topics/tree/route.ts
git commit -m "feat: GET /api/topics/tree — depth Parameter für Vorausladen"
```

---

### Task 8: TopicTreeBrowser Rewrite

**Files:**
- Modify: `src/components/topics/TopicTreeBrowser.tsx`

- [ ] **Ersetze den gesamten Inhalt der Datei**

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { cn, levelLabel } from '@/lib/utils'

interface TreeNode {
  id: string
  name: string
  level: number
  parent_id: string | null
  topic_status: string
  is_fixed_root: boolean
  childCount?: number
  children?: TreeNode[]
}

interface TopicTreeBrowserProps {
  roots: TreeNode[]
}

const levelColors: Record<number, string> = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-purple-100 text-purple-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-gray-100 text-gray-600',
}

function SkeletonRow({ depth }: { depth: number }) {
  return (
    <div
      className="flex items-center gap-2 py-1.5 px-2"
      style={{ paddingLeft: `${depth * 20 + 8}px` }}
    >
      <div className="w-4 h-4 rounded bg-gray-100 animate-pulse flex-shrink-0" />
      <div className="h-3 rounded bg-gray-100 animate-pulse flex-1 max-w-[160px]" />
    </div>
  )
}

function TreeNodeRow({
  node,
  depth,
  isExpanded,
  isLoading,
  onToggle,
  onRename,
  onDelete,
  onAddChild,
}: {
  node: TreeNode
  depth: number
  isExpanded: boolean
  isLoading: boolean
  onToggle: (id: string) => void
  onRename: (id: string, currentName: string) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string) => void
}) {
  const isLeaf = node.level >= 5

  return (
    <div
      className="group flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-gray-50 transition-colors text-sm"
      style={{ paddingLeft: `${depth * 20 + 8}px` }}
    >
      {/* Expand-Button */}
      {!isLeaf ? (
        <button
          onClick={() => onToggle(node.id)}
          className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 flex-shrink-0 transition-colors"
        >
          {isLoading ? (
            <span className="inline-block w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : isExpanded ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      ) : (
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          <span className="w-1 h-1 rounded-full bg-gray-300" />
        </span>
      )}

      {/* Name */}
      <Link
        href={`/topics/${node.id}`}
        className="flex-1 truncate text-gray-700 hover:text-blue-600 transition-colors"
        title={node.name}
      >
        {node.name}
      </Link>

      {/* Level-Badge */}
      <span className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0',
        levelColors[node.level] ?? 'bg-gray-100 text-gray-600'
      )}>
        {levelLabel(node.level)}
      </span>

      {/* Aktions-Buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onRename(node.id, node.name)}
          className="rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-200 transition-colors"
          title="Umbenennen"
        >
          ✎
        </button>
        {!isLeaf && (
          <button
            onClick={() => onAddChild(node.id)}
            className="rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-200 transition-colors"
            title="Unterthema anlegen"
          >
            ＋
          </button>
        )}
        {!node.is_fixed_root && (
          <button
            onClick={() => onDelete(node.id)}
            className="rounded px-1.5 py-0.5 text-[11px] text-red-400 hover:bg-red-50 transition-colors"
            title="Löschen"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

export function TopicTreeBrowser({ roots }: TopicTreeBrowserProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>(roots)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Inline-Rename
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Inline-Neues-Kind
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null)
  const [newChildName, setNewChildName] = useState('')
  const [savingChild, setSavingChild] = useState(false)

  // Alle initial aufklappen (Level 1 Roots)
  useEffect(() => {
    const initialExpanded = new Set<string>()
    roots.forEach(r => {
      if (r.children && r.children.length > 0) initialExpanded.add(r.id)
    })
    setExpanded(initialExpanded)
  }, [roots])

  const expandAll = () => {
    const all = new Set<string>()
    const collect = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          all.add(n.id)
          collect(n.children)
        }
      })
    }
    collect(treeData)
    setExpanded(all)
  }

  const collapseAll = () => setExpanded(new Set())

  const updateNodeInTree = (nodes: TreeNode[], id: string, updater: (n: TreeNode) => TreeNode): TreeNode[] =>
    nodes.map(n => n.id === id ? updater(n) : { ...n, children: n.children ? updateNodeInTree(n.children, id, updater) : undefined })

  const toggleExpand = useCallback(async (id: string) => {
    if (expanded.has(id)) {
      setExpanded(prev => { const next = new Set(prev); next.delete(id); return next })
      return
    }

    // Prüfe ob Kinder schon geladen
    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n
        if (n.children) { const found = findNode(n.children); if (found) return found }
      }
      return null
    }

    const node = findNode(treeData)
    if (!node?.children) {
      setLoadingId(id)
      try {
        const res = await fetch(`/api/topics/${id}`)
        const json = await res.json()
        if (res.ok && json.data?.children) {
          setTreeData(prev => updateNodeInTree(prev, id, n => ({ ...n, children: json.data.children })))
        }
      } catch { /* silent */ }
      setLoadingId(null)
    }

    setExpanded(prev => { const next = new Set(prev); next.add(id); return next })
  }, [expanded, treeData])

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      if (res.ok) {
        setTreeData(prev => updateNodeInTree(prev, id, n => ({ ...n, name: renameValue.trim() })))
        setRenamingId(null)
      } else {
        const json = await res.json()
        setError(json.error ?? 'Fehler beim Umbenennen')
      }
    } catch { setError('Netzwerkfehler') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Topic wirklich löschen?')) return
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      })
      if (res.status === 409) {
        if (confirm('Topic hat Unterthemen. Trotzdem mit allen Unterthemen löschen?')) {
          const res2 = await fetch(`/api/topics/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true }),
          })
          if (res2.ok) window.location.reload()
        }
        return
      }
      if (res.ok) window.location.reload()
      else { const json = await res.json(); setError(json.error ?? 'Fehler') }
    } catch { setError('Netzwerkfehler') }
  }

  const handleAddChild = async (parentId: string) => {
    setAddingChildOf(parentId)
    setNewChildName('')
    if (!expanded.has(parentId)) {
      setExpanded(prev => { const next = new Set(prev); next.add(parentId); return next })
    }
  }

  const saveNewChild = async (parentId: string) => {
    if (!newChildName.trim()) { setAddingChildOf(null); return }
    setSavingChild(true)
    setError(null)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newChildName.trim(), parent_id: parentId }),
      })
      const json = await res.json()
      if (res.ok) {
        const newNode: TreeNode = { ...json.data, children: [] }
        setTreeData(prev => updateNodeInTree(prev, parentId, n => ({
          ...n,
          children: [...(n.children ?? []), newNode],
        })))
        setAddingChildOf(null)
      } else {
        setError(json.error ?? 'Fehler beim Anlegen')
      }
    } catch { setError('Netzwerkfehler') }
    finally { setSavingChild(false) }
  }

  const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expanded.has(node.id)
    const isRenaming = renamingId === node.id

    return (
      <div key={node.id}>
        {/* Verbindungslinie */}
        <div className="relative">
          {depth > 0 && (
            <span
              className="absolute top-1/2 border-t border-gray-200 pointer-events-none"
              style={{ left: `${(depth - 1) * 20 + 16}px`, width: '12px' }}
            />
          )}

          {isRenaming ? (
            <div
              className="flex items-center gap-2 py-1.5 px-2 bg-blue-50 rounded-md"
              style={{ paddingLeft: `${depth * 20 + 8}px` }}
            >
              <span className="w-4 h-4 flex-shrink-0" />
              <input
                type="text"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename(node.id)
                  if (e.key === 'Escape') setRenamingId(null)
                }}
                autoFocus
                className="flex-1 rounded border border-blue-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => handleRename(node.id)} className="text-[11px] text-blue-600 font-medium">OK</button>
              <button onClick={() => setRenamingId(null)} className="text-[11px] text-gray-400">Abb.</button>
            </div>
          ) : (
            <TreeNodeRow
              node={node}
              depth={depth}
              isExpanded={isExpanded}
              isLoading={loadingId === node.id}
              onToggle={toggleExpand}
              onRename={(id, name) => { setRenamingId(id); setRenameValue(name) }}
              onDelete={handleDelete}
              onAddChild={handleAddChild}
            />
          )}
        </div>

        {/* Kinder */}
        {isExpanded && (
          <div className="relative">
            {depth >= 0 && (
              <span
                className="absolute top-0 bottom-0 border-l border-gray-200 pointer-events-none"
                style={{ left: `${depth * 20 + 16}px` }}
              />
            )}
            {loadingId === node.id ? (
              <>
                <SkeletonRow depth={depth + 1} />
                <SkeletonRow depth={depth + 1} />
              </>
            ) : node.children && node.children.length > 0 ? (
              node.children.map(child => renderNode(child, depth + 1))
            ) : node.children && node.children.length === 0 ? (
              <div className="text-xs text-gray-400 py-1" style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}>
                Keine Unterthemen
              </div>
            ) : null}

            {/* Inline-Neues-Kind */}
            {addingChildOf === node.id && (
              <div
                className="flex items-center gap-2 py-1.5 px-2"
                style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
              >
                <input
                  type="text"
                  value={newChildName}
                  onChange={e => setNewChildName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveNewChild(node.id)
                    if (e.key === 'Escape') setAddingChildOf(null)
                  }}
                  placeholder="Neues Unterthema…"
                  autoFocus
                  disabled={savingChild}
                  className="flex-1 rounded border border-blue-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => saveNewChild(node.id)}
                  disabled={savingChild}
                  className="text-[11px] text-blue-600 font-medium disabled:opacity-50"
                >
                  {savingChild ? '…' : 'OK'}
                </button>
                <button onClick={() => setAddingChildOf(null)} className="text-[11px] text-gray-400">Abb.</button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">✕</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={expandAll}
          className="rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Alle aufklappen
        </button>
        <button
          onClick={collapseAll}
          className="rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Alle einklappen
        </button>
      </div>

      {treeData.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          Noch keine Topics vorhanden.{' '}
          <Link href="/topics/new" className="text-blue-600 hover:underline">
            Erstelle das erste Topic
          </Link>
        </div>
      ) : (
        <div className="space-y-0">
          {treeData.map(root => renderNode(root))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Topics-Page anpassen** um depth=2 zu übergeben

In `src/app/(admin)/topics/page.tsx`, ersetze `getRootTopicsWithCount(supabase)` durch einen direkten Fetch:

```typescript
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { TopicViewSwitcher } from '@/components/topics/TopicViewSwitcher'
import Link from 'next/link'

export default async function TopicsPage() {
  const supabase = await createClient()

  // Roots + Level-2 in einem Call laden
  const { data: treeWithDepth2 } = await supabase
    .from('topics')
    .select('id, name, level, parent_id, topic_status, is_fixed_root')
    .eq('topic_status', 'active')
    .is('parent_id', null)
    .order('name')

  // Kinder für jeden Root holen
  const roots = await Promise.all(
    (treeWithDepth2 ?? []).map(async (root) => {
      const { data: children } = await supabase
        .from('topics')
        .select('id, name, level, parent_id, topic_status, is_fixed_root')
        .eq('parent_id', root.id)
        .eq('topic_status', 'active')
        .order('name')
      return { ...root, children: children ?? [], childCount: children?.length ?? 0 }
    })
  )

  return (
    <div>
      <PageHeader
        title="Topics"
        description="Themenstruktur der Wissensdatenbank"
        icon="☰"
        action={
          <Link
            href="/topics/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 shadow-sm"
          >
            <span>＋</span> Neues Topic
          </Link>
        }
      />
      <TopicViewSwitcher roots={roots} />
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/topics/TopicTreeBrowser.tsx src/app/(admin)/topics/page.tsx
git commit -m "feat: TopicTreeBrowser — Redesign mit Verbindungslinien, Level-Badges, depth=2 Preload, Inline-Kind-Anlage"
```

---

## Phase 3 — Performance

### Task 9: N+1 in getRootTopicsWithCount fixen

**Files:**
- Modify: `src/lib/services/topic.service.ts`

- [ ] **Ersetze `getRootTopicsWithCount`**

```typescript
export async function getRootTopicsWithCount(supabase: Supabase) {
  const roots = await db.getRootTopics(supabase)
  if (roots.length === 0) return []

  const rootIds = roots.map(r => r.id)

  // Alle Kinderzahlen in einem Query statt N einzelnen Calls
  const { data: counts } = await supabase
    .from('topics')
    .select('parent_id')
    .in('parent_id', rootIds)

  const countMap = new Map<string, number>()
  for (const row of counts ?? []) {
    if (row.parent_id) {
      countMap.set(row.parent_id, (countMap.get(row.parent_id) ?? 0) + 1)
    }
  }

  return roots.map(topic => {
    const childCount = countMap.get(topic.id) ?? 0
    return { ...topic, childCount, isLeaf: childCount === 0 } as TopicNode
  })
}
```

- [ ] **Commit**

```bash
git add src/lib/services/topic.service.ts
git commit -m "perf: getRootTopicsWithCount — N+1 durch einzelnen COUNT-Query ersetzt"
```

---

### Task 10: Parallele Batch-Klassifizierung

**Files:**
- Modify: `src/lib/services/classifier.service.ts`
- Modify: `src/app/(admin)/review/page.tsx`

- [ ] **Füge `classifyParallel` am Ende von `classifier.service.ts` hinzu**

```typescript
export async function classifyParallel(
  supabase: SupabaseClient<Database>,
  itemIds: string[],
  concurrency = 3,
  onProgress?: (progress: { current: number; total: number; success: number; failed: number }) => void,
  signal?: AbortSignal
): Promise<{ success: number; failed: number; results: ClassifyResult[] }> {
  let current = 0
  let success = 0
  let failed = 0
  const results: ClassifyResult[] = []

  for (let i = 0; i < itemIds.length; i += concurrency) {
    if (signal?.aborted) break

    const batch = itemIds.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map(id => classifyItem(supabase, id))
    )

    for (const r of batchResults) {
      current++
      if (r.status === 'fulfilled') {
        results.push(r.value)
        if (r.value.status === 'success') success++
        else failed++
      } else {
        failed++
      }
      onProgress?.({ current, total: itemIds.length, success, failed })
    }
  }

  return { success, failed, results }
}
```

- [ ] **Ersetze in `review/page.tsx` den Bulk-Klassifizierungs-Block**

Finde den `bulkClassify`-Handler (oder `classifyAll`) in der Review-Seite und ersetze ihn. Der bestehende `bulkStopRef` bleibt, wird aber jetzt als `AbortController` genutzt:

```typescript
// Am Anfang der Komponente, nach den bestehenden useState-Deklarationen:
const abortControllerRef = useRef<AbortController | null>(null)

const classifyAllPending = async () => {
  setBulkClassifying(true)
  setBulkProgress({ current: 0, total: 0, success: 0, failed: 0 })
  bulkStopRef.current = false
  abortControllerRef.current = new AbortController()

  try {
    // Hole alle pending IDs
    const res = await fetch('/api/review?status=pending&pageSize=500&page=1')
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Fehler'); return }

    const ids: string[] = (json.data ?? []).map((item: { id: string }) => item.id)
    if (ids.length === 0) { setInfo('Keine pending Items gefunden.'); return }

    setBulkProgress({ current: 0, total: ids.length, success: 0, failed: 0 })

    const progressRes = await fetch('/api/classify/batch-parallel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, concurrency: 3 }),
      signal: abortControllerRef.current.signal,
    })

    const progressJson = await progressRes.json()
    if (progressRes.ok) {
      setInfo(`${progressJson.data.success} klassifiziert, ${progressJson.data.failed} fehlgeschlagen.`)
      await loadItems()
      await loadStats()
    } else {
      setError(progressJson.error ?? 'Fehler')
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') setError('Fehler bei Batch-Klassifizierung')
  } finally {
    setBulkClassifying(false)
    setBulkProgress(null)
    abortControllerRef.current = null
  }
}

const stopBulkClassify = () => {
  abortControllerRef.current?.abort()
  bulkStopRef.current = true
}
```

- [ ] **Erstelle den neuen Batch-Parallel-Endpoint** `src/app/api/classify/batch-parallel/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyParallel } from '@/lib/services/classifier.service'
import { formatError } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { ids: string[]; concurrency?: number }
    const { ids, concurrency = 3 } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids fehlen' }, { status: 400 })
    }

    const supabase = await createClient()
    const { success, failed } = await classifyParallel(supabase, ids, concurrency)

    return NextResponse.json({ data: { success, failed, total: ids.length } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
```

- [ ] **Füge in der Review-UI den Fortschrittsbalken hinzu** (direkt unter dem PageHeader):

```tsx
{bulkClassifying && bulkProgress && (
  <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm text-blue-700 font-medium">
        Klassifiziere… {bulkProgress.current} / {bulkProgress.total}
      </span>
      <div className="flex items-center gap-3 text-xs text-blue-600">
        <span>✓ {bulkProgress.success}</span>
        <span className="text-red-500">✕ {bulkProgress.failed}</span>
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

- [ ] **Commit**

```bash
git add src/lib/services/classifier.service.ts src/app/api/classify/batch-parallel/route.ts src/app/(admin)/review/page.tsx
git commit -m "feat: parallele Batch-Klassifizierung mit Promise.allSettled, Fortschrittsbalken, Stop-Button"
```

---

### Task 11: DB-Indizes Migration

**Files:**
- Modify: `supabase/migrations/20260505_016_performance_indexes.sql`

- [ ] **Ergänze die bestehende Migration um die Indizes** (Datei wurde in Task 3 angelegt)

```sql
-- Bestehende cleanup_orphaned_prompts Funktion ist bereits oben

-- Paginierte Review-Queries (häufigster Filter: status + Sortierung nach created_at)
CREATE INDEX IF NOT EXISTS incoming_items_status_created_idx
  ON incoming_items(status, created_at DESC);

-- Batch-Klassifizierung: Filter nach processing_state
CREATE INDEX IF NOT EXISTS incoming_items_processing_state_idx
  ON incoming_items(processing_state);

-- FK-JOIN Performance: feed_id
CREATE INDEX IF NOT EXISTS incoming_items_feed_id_idx
  ON incoming_items(feed_id);
```

- [ ] **Migriere in Supabase** (im Supabase-Dashboard unter SQL-Editor ausführen oder per CLI):

```bash
# Falls supabase CLI verfügbar:
supabase db push
# Alternativ: Inhalt der SQL-Datei im Supabase Dashboard > SQL Editor ausführen
```

- [ ] **Commit**

```bash
git add supabase/migrations/20260505_016_performance_indexes.sql
git commit -m "perf: DB-Indizes für status+created_at, processing_state, feed_id"
```

---

## Selbst-Review

**Spec-Abdeckung:**
- ✅ Cleanup-Dashboard mit 5 Bereichen + Preview-API + Modal-Bestätigung
- ✅ Sidebar-Link "Aufräumen"
- ✅ Baum: Verbindungslinien, Chevron-Icons, Level-Badges, Toolbar (Alle auf/ein)
- ✅ Baum: depth=2 Preload, State-Caching für Lazy-Load
- ✅ Baum: Inline-Rename + Inline-Kind-Anlegen
- ✅ Parallele Batch-KI mit concurrency=3, Fortschrittsbalken, Stop-Button
- ✅ N+1 in getRootTopicsWithCount behoben
- ✅ DB-Indizes (status+created_at, processing_state, feed_id)
- ✅ cleanup_orphaned_prompts DB-Funktion

**Keine Platzhalter:** Alle Steps enthalten vollständigen Code.

**Typ-Konsistenz:** `ClassifyResult`, `TreeNode`, `PreviewData` konsistent durch alle Tasks.
