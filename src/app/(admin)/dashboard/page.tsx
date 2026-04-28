'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DashboardStats {
  active_feeds: number
  total_items: number
  pending_items: number
  classified_items: number
  failed_items: number
  done_items: number
  avg_confidence: number | null
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
      <div>
        <h1 className="text-lg font-medium text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">RSS · Klassifizierung · Review</p>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Aktive Feeds', value: s?.active_feeds, href: '/settings/feeds', color: 'border-green-200 bg-green-50/50' },
          { label: 'Pending Items', value: s?.pending_items, href: '/review?state=pending', color: 'border-amber-200 bg-amber-50/50' },
          { label: 'Klassifiziert', value: s?.classified_items, href: '/review?state=classified', color: 'border-blue-200 bg-blue-50/50' },
          { label: 'Fehlerhaft', value: s?.failed_items, href: '/review?state=failed', color: 'border-red-200 bg-red-50/50' },
        ].map(c => (
          <Link key={c.label} href={c.href} className={`rounded-lg border p-4 hover:shadow-sm transition-all ${c.color}`}>
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-2xl font-medium text-gray-800">{loading ? '…' : (c.value ?? '–')}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Avg Confidence */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Ø Konfidenz (primary)</p>
          <p className="text-2xl font-medium text-gray-800">
            {s?.avg_confidence != null ? `${(s.avg_confidence * 100).toFixed(1)}%` : '–'}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {s?.successful_runs ?? 0} ok · {s?.failed_runs ?? 0} fehlgeschlagen ({s?.total_runs ?? 0} gesamt)
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

      {/* Schnellzugriff */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-medium text-gray-700">Schnellzugriff</h2>
        </div>
        <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { href: '/topics', label: 'Topics' },
            { href: '/topics/new', label: '+ Neues Topic' },
            { href: '/review', label: 'Review-Queue' },
            { href: '/settings/feeds', label: 'Feeds' },
            { href: '/settings/classifier', label: 'KI-Einstellungen' },
            { href: '/classification-logs', label: 'KI-Logs' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
