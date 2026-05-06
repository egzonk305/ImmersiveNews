'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DashboardStats {
  active_feeds: number
  pending_items: number
  processing_items: number
  classified_items: number
  failed_items: number
  done_items: number
  review_pending: number
  items_last_24h: number
  avg_primary_confidence: number | null
  auto_created_topics?: number
  story_count?: number
  avg_processing_ms?: number | null
}

interface RunStats {
  total_runs: number
  successful_runs: number
  failed_runs: number
}

interface ItemsPerRoot {
  root_id: string
  root_name: string
  item_count: number
}

interface RecentRun {
  id: string
  status: string
  model: string | null
  duration_ms: number | null
  error_message: string | null
  created_at: string
  incoming_item_id: string
}

interface RecentFeed {
  id: string
  name: string
  last_fetched_at: string | null
  last_error: string | null
  item_count: number | null
  is_active: boolean
}

interface LowConfItem {
  incoming_item_id: string
  title: string
  topic_name: string
  confidence: number
}

interface DashData {
  stats: DashboardStats | null
  itemsPerRoot: ItemsPerRoot[]
  recentRuns: RecentRun[]
  recentFeeds: RecentFeed[]
  lowConfidence: LowConfItem[]
  runStats: RunStats
}

const statusColors: Record<string, string> = {
  success: 'text-green-700 bg-green-50',
  failed: 'text-red-700 bg-red-50',
  parse_error: 'text-amber-700 bg-amber-50',
  pending: 'text-gray-600 bg-gray-100',
}

function formatTime(iso: string | null) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json())
      .then(j => setData(j.data))
      .finally(() => setLoading(false))
  }, [])

  const s = data?.stats

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">RSS · Klassifizierung · Review</p>
        </div>
        <div className="flex gap-2">
          <Link href="/review" className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-medium transition-colors">
            Review-Queue öffnen
          </Link>
          <Link href="/settings/feeds" className="rounded-md border border-gray-200 hover:bg-white text-gray-700 px-3.5 py-2 text-xs font-medium transition-colors">
            Feeds verwalten
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Aktive Feeds', value: s?.active_feeds, href: '/settings/feeds', icon: '⟳', accent: 'text-green-700 bg-green-50 border-green-200' },
          { label: 'Pending', value: s?.pending_items, href: '/review?status=pending', icon: '⧖', accent: 'text-amber-700 bg-amber-50 border-amber-200' },
          { label: 'Klassifiziert', value: s?.classified_items, href: '/review?status=pending', icon: '✓', accent: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'Fehlerhaft', value: s?.failed_items, href: '/review?status=pending', icon: '⚠', accent: 'text-red-700 bg-red-50 border-red-200' },
          { label: 'Auto-Topics', value: s?.auto_created_topics, href: '/topics', icon: '＋', accent: 'text-purple-700 bg-purple-50 border-purple-200' },
          { label: 'Storys', value: s?.story_count, href: '/review', icon: '◈', accent: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
          { label: 'Ø Verarbeitung', value: s?.avg_processing_ms ? `${s.avg_processing_ms} ms` : null, href: '/classification-logs', icon: '⏱', accent: 'text-gray-700 bg-gray-50 border-gray-200' },
        ].map(c => (
          <Link
            key={c.label}
            href={c.href}
            className="group rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">{c.label}</p>
              <span className={`inline-flex w-7 h-7 items-center justify-center rounded-md text-sm border ${c.accent}`}>
                {c.icon}
              </span>
            </div>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums">
              {loading ? <span className="inline-block w-10 h-7 rounded bg-gray-100 animate-pulse" /> : (c.value ?? '–')}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Avg Confidence */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Ø Konfidenz (primary)</p>
          <p className="text-2xl font-medium text-gray-800">
            {s?.avg_primary_confidence != null ? `${(s.avg_primary_confidence * 100).toFixed(1)}%` : '–'}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {data?.runStats.successful_runs ?? 0} ok · {data?.runStats.failed_runs ?? 0} fehlgeschlagen ({data?.runStats.total_runs ?? 0} gesamt)
          </p>
        </div>

        {/* Items per Root */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
          <p className="text-xs text-gray-500 mb-2">Items pro Root-Thema</p>
          {data?.itemsPerRoot.length ? (
            <ul className="space-y-1.5">
              {data.itemsPerRoot.map(r => (
                <li key={r.root_id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{r.root_name}</span>
                  <span className="font-medium text-gray-800">{r.item_count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400">Noch keine Daten.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Letzte Feeds */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">Letzte Feed-Abrufe</h2>
            <Link href="/settings/feeds" className="text-xs text-blue-600 hover:underline">Alle</Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {(data?.recentFeeds ?? []).map(f => (
              <li key={f.id} className="px-4 py-2.5 text-sm flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-gray-800">{f.name}</p>
                  <p className="text-xs text-gray-400">{formatTime(f.last_fetched_at)}</p>
                </div>
                {f.last_error ? (
                  <span className="text-xs text-red-600">Fehler</span>
                ) : (
                  <span className="text-xs text-gray-500">{f.item_count ?? 0} Items</span>
                )}
              </li>
            ))}
            {(!data?.recentFeeds || data.recentFeeds.length === 0) && (
              <li className="px-4 py-6 text-center text-xs text-gray-400">Noch keine Feeds abgerufen.</li>
            )}
          </ul>
        </div>

        {/* Letzte Klassifizierungen */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">Letzte Klassifizierungen</h2>
            <Link href="/classification-logs" className="text-xs text-blue-600 hover:underline">Alle</Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {(data?.recentRuns ?? []).map(r => (
              <li key={r.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-gray-800 text-xs">{r.model ?? '–'}</p>
                  <p className="text-xs text-gray-400">{formatTime(r.created_at)} · {r.duration_ms ?? '–'} ms</p>
                </div>
                <span className={`text-[11px] rounded px-2 py-0.5 ${statusColors[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {r.status}
                </span>
              </li>
            ))}
            {(!data?.recentRuns || data.recentRuns.length === 0) && (
              <li className="px-4 py-6 text-center text-xs text-gray-400">Noch keine Klassifizierungsläufe.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Low Confidence */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/30">
        <div className="border-b border-amber-100 px-4 py-3">
          <h2 className="text-sm font-medium text-amber-800">Items mit niedriger Konfidenz</h2>
        </div>
        {data?.lowConfidence.length ? (
          <ul className="divide-y divide-amber-100">
            {data.lowConfidence.map(it => (
              <li key={it.incoming_item_id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3">
                <Link href={`/review`} className="truncate text-gray-800 hover:text-blue-600">
                  {it.title}
                </Link>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-500">→ {it.topic_name}</span>
                  <span className="text-xs font-medium text-amber-700">
                    {(it.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-xs text-gray-500">
            Keine Items unterhalb der Schwelle. ✓
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-medium text-gray-700">Schnellzugriff</h2>
        </div>
        <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { href: '/topics', label: 'Topics', icon: '☰', desc: 'Themenbaum verwalten' },
            { href: '/topics/new', label: 'Neues Topic', icon: '＋', desc: 'Unterthema anlegen' },
            { href: '/review', label: 'Review-Queue', icon: '✓', desc: 'KI-Vorschläge prüfen' },
            { href: '/settings/feeds', label: 'RSS-Feeds', icon: '⟳', desc: 'Feed-Quellen verwalten' },
            { href: '/settings/classifier', label: 'KI-Einstellungen', icon: '🧠', desc: 'Modell konfigurieren' },
            { href: '/classification-logs', label: 'KI-Logs', icon: '📋', desc: 'Klassifizierungsläufe' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-md border border-gray-200 px-3 py-3 text-sm hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-start gap-3"
            >
              <span className="w-8 h-8 shrink-0 rounded-md bg-gray-50 group-hover:bg-white border border-gray-200 flex items-center justify-center text-gray-600">
                {item.icon}
              </span>
              <div className="min-w-0">
                <p className="text-gray-800 font-medium">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
