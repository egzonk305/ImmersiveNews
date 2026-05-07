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

const statusPill: Record<string, string> = {
  success: 'pill-success',
  failed: 'pill-danger',
  parse_error: 'pill-warning',
  pending: 'pill-neutral',
}

function formatTime(iso: string | null) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

interface StatTile {
  label: string
  value: number | string | null | undefined
  href: string
  icon: string
  hue: 'emerald' | 'amber' | 'sky' | 'rose' | 'violet' | 'slate'
}

const hueStyles: Record<StatTile['hue'], { bg: string; text: string; ring: string }> = {
  emerald: { bg: 'rgba(167,243,208,0.35)', text: 'rgb(4 120 87)',  ring: 'rgba(110,231,183,0.45)' },
  amber:   { bg: 'rgba(254,215,170,0.35)', text: 'rgb(180 83 9)',  ring: 'rgba(252,211,77,0.50)' },
  sky:     { bg: 'rgba(186,230,253,0.40)', text: 'rgb(3 105 161)', ring: 'rgba(125,211,252,0.50)' },
  rose:    { bg: 'rgba(254,205,211,0.35)', text: 'rgb(190 18 60)', ring: 'rgba(253,164,175,0.50)' },
  violet:  { bg: 'rgba(221,214,254,0.40)', text: 'rgb(91 33 182)', ring: 'rgba(196,181,253,0.50)' },
  slate:   { bg: 'rgba(226,232,240,0.50)', text: 'rgb(51 65 85)',  ring: 'rgba(203,213,225,0.55)' },
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

  const tiles: StatTile[] = [
    { label: 'Aktive Feeds',  value: s?.active_feeds,        href: '/settings/feeds',           icon: '⟳', hue: 'emerald' },
    { label: 'Pending',       value: s?.pending_items,       href: '/review?status=pending',    icon: '⧖', hue: 'amber'   },
    { label: 'Klassifiziert', value: s?.classified_items,    href: '/review?status=pending',    icon: '✓', hue: 'sky'     },
    { label: 'Fehlerhaft',    value: s?.failed_items,        href: '/review?status=pending',    icon: '!', hue: 'rose'    },
    { label: 'Auto-Topics',   value: s?.auto_created_topics, href: '/topics',                    icon: '＋', hue: 'violet'  },
    { label: 'Ø Verarbeitung',value: s?.avg_processing_ms ? `${s.avg_processing_ms} ms` : null, href: '/classification-logs', icon: '⏱', hue: 'slate' },
  ]

  return (
    <div className="space-y-8">
      {/* Hero */}
      <header className="flex items-end justify-between gap-4 flex-wrap animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 leading-none">
            Guten Tag <span className="text-gradient">👋</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {s?.items_last_24h != null
              ? <>Heute <span className="font-semibold text-slate-700">{s.items_last_24h}</span> neue Artikel · {data?.runStats.total_runs ?? 0} Klassifizierungsläufe</>
              : 'Übersicht über RSS, Klassifizierung und Review'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/review" className="btn-primary">
            <span>Review öffnen</span>
            <span className="text-base leading-none">→</span>
          </Link>
          <Link href="/settings/feeds" className="btn-secondary">
            Feeds
          </Link>
        </div>
      </header>

      {/* Stat tiles */}
      <section
        className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 animate-fade-in-up"
        style={{ animationDelay: '50ms', animationFillMode: 'backwards' }}
      >
        {tiles.map((t, i) => {
          const h = hueStyles[t.hue]
          return (
            <Link
              key={t.label}
              href={t.href}
              className="glass-card-lift rounded-2xl p-4"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-medium text-slate-500 tracking-wide">
                  {t.label}
                </p>
                <span
                  className="inline-flex w-7 h-7 items-center justify-center rounded-xl text-xs font-semibold"
                  style={{ background: h.bg, color: h.text, boxShadow: `inset 0 0 0 1px ${h.ring}` }}
                  aria-hidden
                >
                  {t.icon}
                </span>
              </div>
              <p className="text-2xl font-semibold text-slate-800 tabular-nums tracking-tight">
                {loading ? <span className="skeleton inline-block w-12 h-7 align-middle" /> : (t.value ?? '–')}
              </p>
            </Link>
          )
        })}
      </section>

      {/* Confidence + Items per Root */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[11px] font-medium text-slate-500 tracking-wide mb-2">
            Ø KONFIDENZ
          </p>
          <p className="text-3xl font-bold text-slate-800 tabular-nums tracking-tight">
            {s?.avg_primary_confidence != null
              ? `${(s.avg_primary_confidence * 100).toFixed(1)}%`
              : '–'}
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11px]">
            <span className="pill pill-success">{data?.runStats.successful_runs ?? 0} ok</span>
            <span className="pill pill-danger">{data?.runStats.failed_runs ?? 0} fehler</span>
            <span className="text-slate-400">von {data?.runStats.total_runs ?? 0}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 lg:col-span-2">
          <p className="text-[11px] font-medium text-slate-500 tracking-wide mb-3">
            ITEMS PRO ROOT-THEMA
          </p>
          {data?.itemsPerRoot.length ? (
            <ul className="space-y-2">
              {data.itemsPerRoot.map(r => {
                const max = Math.max(...data.itemsPerRoot.map(x => x.item_count), 1)
                const pct = (r.item_count / max) * 100
                return (
                  <li key={r.root_id} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-700 w-24 truncate">{r.root_name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100/60 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)',
                        }}
                      />
                    </div>
                    <span className="font-semibold text-slate-700 tabular-nums w-10 text-right">
                      {r.item_count}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">Noch keine Daten.</p>
          )}
        </div>
      </section>

      {/* Recent feeds + classifications */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.60)' }}>
            <h2 className="text-sm font-semibold text-slate-700 tracking-tight">Letzte Feed-Abrufe</h2>
            <Link href="/settings/feeds" className="text-[11px] font-medium text-violet-600 hover:text-violet-800 transition-colors">
              Alle →
            </Link>
          </div>
          <ul className="divide-y divide-white/40">
            {(data?.recentFeeds ?? []).map(f => (
              <li key={f.id} className="px-5 py-3 text-sm flex items-center justify-between hover:bg-white/30 transition-colors">
                <div className="min-w-0">
                  <p className="truncate text-slate-700 font-medium">{f.name}</p>
                  <p className="text-[11px] text-slate-400">{formatTime(f.last_fetched_at)}</p>
                </div>
                {f.last_error ? (
                  <span className="pill pill-danger">Fehler</span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-medium tabular-nums">{f.item_count ?? 0} Items</span>
                )}
              </li>
            ))}
            {(!data?.recentFeeds || data.recentFeeds.length === 0) && (
              <li className="px-5 py-8 text-center text-xs text-slate-400">Noch keine Feeds abgerufen.</li>
            )}
          </ul>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.60)' }}>
            <h2 className="text-sm font-semibold text-slate-700 tracking-tight">Letzte Klassifizierungen</h2>
            <Link href="/classification-logs" className="text-[11px] font-medium text-violet-600 hover:text-violet-800 transition-colors">
              Alle →
            </Link>
          </div>
          <ul className="divide-y divide-white/40">
            {(data?.recentRuns ?? []).map(r => (
              <li key={r.id} className="px-5 py-3 text-sm flex items-center justify-between gap-3 hover:bg-white/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-slate-700 text-xs font-mono truncate">{r.model ?? '–'}</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    {formatTime(r.created_at)} · {r.duration_ms ?? '–'} ms
                  </p>
                </div>
                <span className={`pill ${statusPill[r.status] ?? 'pill-neutral'}`}>
                  {r.status}
                </span>
              </li>
            ))}
            {(!data?.recentRuns || data.recentRuns.length === 0) && (
              <li className="px-5 py-8 text-center text-xs text-slate-400">Noch keine Läufe.</li>
            )}
          </ul>
        </div>
      </section>

      {/* Low Confidence */}
      <section
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,251,235,0.40)',
          border: '1px solid rgba(251,191,36,0.30)',
          boxShadow: '0 2px 8px rgba(180,83,9,0.05)',
        }}
      >
        <div
          className="px-5 py-3.5 flex items-center gap-2"
          style={{ borderBottom: '1px solid rgba(251,191,36,0.20)' }}
        >
          <span className="text-amber-500">⚠</span>
          <h2 className="text-sm font-semibold text-amber-800 tracking-tight">
            Items mit niedriger Konfidenz
          </h2>
        </div>
        {data?.lowConfidence.length ? (
          <ul className="divide-y divide-amber-100/50">
            {data.lowConfidence.map(it => (
              <li key={it.incoming_item_id} className="px-5 py-3 text-sm flex items-center justify-between gap-3 hover:bg-amber-50/30 transition-colors">
                <Link href="/review" className="truncate text-slate-700 hover:text-violet-700 transition-colors">
                  {it.title}
                </Link>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[11px] text-slate-500">→ {it.topic_name}</span>
                  <span className="pill pill-warning tabular-nums">
                    {(it.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-xs text-slate-500">
            Keine Items unterhalb der Schwelle. <span className="text-emerald-600 font-medium">✓</span>
          </p>
        )}
      </section>

      {/* Schnellzugriff */}
      <section className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.60)' }}>
          <h2 className="text-sm font-semibold text-slate-700 tracking-tight">Schnellzugriff</h2>
        </div>
        <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { href: '/topics',            label: 'Topics',           icon: '☰', desc: 'Themenbaum verwalten' },
            { href: '/review',            label: 'Review-Queue',     icon: '✓', desc: 'KI-Vorschläge prüfen' },
            { href: '/settings/feeds',    label: 'RSS-Feeds',        icon: '⟳', desc: 'Feed-Quellen verwalten' },
            { href: '/settings/classifier', label: 'KI-Einstellungen', icon: '◉', desc: 'Modell konfigurieren' },
            { href: '/classification-logs', label: 'KI-Logs',          icon: '☰', desc: 'Klassifizierungsläufe' },
            { href: '/cleanup',           label: 'Aufräumen',        icon: '⌫', desc: 'Alte Daten bereinigen' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="glass-card-lift rounded-xl px-4 py-3 text-sm flex items-start gap-3"
            >
              <span
                className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-slate-500 text-base font-medium"
                style={{
                  background: 'rgba(255,255,255,0.60)',
                  border: '1px solid rgba(255,255,255,0.85)',
                }}
              >
                {item.icon}
              </span>
              <div className="min-w-0">
                <p className="text-slate-700 font-semibold tracking-tight">{item.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
