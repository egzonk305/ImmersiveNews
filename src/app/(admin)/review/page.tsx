'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { CandidateList } from '@/components/review/CandidateList'
import { TopicPicker } from '@/components/review/TopicPicker'
import type { IncomingItem, ProcessingState } from '@/lib/types/database.types'

type ReviewStats = {
  pending: number
  approved: number
  rejected: number
  needs_edit: number
  total: number
}

type ItemWithFeed = IncomingItem & {
  rss_feeds?: { id: string; name: string; url: string } | null
}

const statusLabels: Record<string, string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  needs_edit: 'Bearbeitung nötig',
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  needs_edit: 'bg-blue-50 text-blue-700 border-blue-200',
}

const procStateColors: Record<ProcessingState, string> = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-yellow-100 text-yellow-700',
  classified: 'bg-purple-100 text-purple-700',
  failed: 'bg-red-100 text-red-700',
  done: 'bg-green-100 text-green-700',
}

export default function ReviewPage() {
  const [items, setItems] = useState<ItemWithFeed[]>([])
  const [stats, setStats] = useState<ReviewStats>({ pending: 0, approved: 0, rejected: 0, needs_edit: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [classifyingId, setClassifyingId] = useState<string | null>(null)
  const [bulkClassifying, setBulkClassifying] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null)
  const bulkStopRef = useRef(false)
  const [pickerOpen, setPickerOpen] = useState<string | null>(null)
  const pageSize = 20

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/review/stats')
      const json = await res.json()
      if (res.ok) setStats(json.data)
    } catch { /* silent */ }
  }, [])

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        pageSize: String(pageSize),
      })
      const res = await fetch(`/api/review?${params}`)
      const json = await res.json()
      if (res.ok) {
        setItems(json.data ?? [])
        setCount(json.count ?? 0)
      } else {
        setError(json.error)
      }
    } catch {
      setError('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadItems() }, [loadItems])

  const handleAction = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/review/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        loadItems(); loadStats()
      } else {
        const json = await res.json(); setError(json.error)
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eintrag endgültig löschen?')) return
    const res = await fetch(`/api/review/${id}`, { method: 'DELETE' })
    if (res.ok) { loadItems(); loadStats() }
  }

  const handleClassify = async (id: string) => {
    setClassifyingId(id)
    setError(null); setInfo(null)
    try {
      const res = await fetch(`/api/classify/${id}`, { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setInfo(
          json.data.status === 'success'
            ? `Klassifiziert: ${json.data.candidates_saved} Kandidaten${json.data.auto_accepted ? ' (auto-akzeptiert)' : ''}`
            : `Fehlgeschlagen: ${json.data.error}`
        )
        setExpandedId(id)
        loadItems(); loadStats()
      } else {
        setError(json.error)
      }
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setClassifyingId(null)
    }
  }

  const handleReclassify = async (id: string) => {
    setClassifyingId(id)
    try {
      const res = await fetch(`/api/review/${id}/reclassify`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) setError(json.error)
      else {
        setInfo('Neu klassifiziert.')
        loadItems()
      }
    } finally {
      setClassifyingId(null)
    }
  }

  const handleBulk = async (action: 'approve' | 'reject' | 'delete') => {
    if (selected.size === 0) return
    if (action === 'delete' && !confirm(`${selected.size} Einträge endgültig löschen?`)) return
    const res = await fetch('/api/review/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), action }),
    })
    if (res.ok) { setSelected(new Set()); loadItems(); loadStats() }
    else { const j = await res.json(); setError(j.error) }
  }

  const handleClassifyAll = async () => {
    if (!confirm('Alle pending Items klassifizieren?')) return
    setError(null); setInfo(null)
    setBulkClassifying(true)
    bulkStopRef.current = false

    // Alle pending IDs laden
    const res = await fetch('/api/review?status=pending&pageSize=500&page=1')
    const json = await res.json()
    if (!res.ok) { setError(json.error); setBulkClassifying(false); return }

    const ids: string[] = (json.data ?? [])
      .filter((i: { processing_state: string }) => i.processing_state === 'pending')
      .map((i: { id: string }) => i.id)

    if (ids.length === 0) { setInfo('Keine pending Items.'); setBulkClassifying(false); return }

    let success = 0, failed = 0
    setBulkProgress({ current: 0, total: ids.length, success: 0, failed: 0 })

    for (let i = 0; i < ids.length; i++) {
      if (bulkStopRef.current) break
      try {
        const r = await fetch(`/api/classify/${ids[i]}`, { method: 'POST' })
        const j = await r.json()
        if (r.ok && j.data?.status === 'success') success++; else failed++
      } catch { failed++ }
      setBulkProgress({ current: i + 1, total: ids.length, success, failed })
    }

    setInfo(`${success} von ${ids.length} klassifiziert (${failed} Fehler)`)
    setBulkProgress(null)
    setBulkClassifying(false)
    loadItems(); loadStats()
  }

  const handleAddManual = async (itemId: string, topicId: string) => {
    const res = await fetch(`/api/review/${itemId}/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id: topicId, is_primary: true }),
    })
    if (!res.ok) { const j = await res.json(); setError(j.error) }
    else loadItems()
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === items.length) setSelected(new Set())
    else setSelected(new Set(items.map(i => i.id)))
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div>
      <PageHeader
        title="Review-Queue"
        description="KI-Klassifizierung prüfen und Zuordnungen bestätigen"
        action={
          <div className="flex items-center gap-3">
            {bulkProgress && (
              <div className="flex items-center gap-2">
                <div className="w-32 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all"
                    style={{ width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {bulkProgress.current}/{bulkProgress.total}
                  {bulkProgress.failed > 0 && <span className="text-red-500"> · {bulkProgress.failed} Fehler</span>}
                </span>
                <button
                  onClick={() => { bulkStopRef.current = true }}
                  className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                >
                  Stopp
                </button>
              </div>
            )}
            <button
              onClick={handleClassifyAll}
              disabled={bulkClassifying}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {bulkClassifying ? 'Klassifiziere…' : '🧠 Alle pending klassifizieren'}
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">✕</button>
        </div>
      )}
      {info && (
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex justify-between">
          <span>{info}</span>
          <button onClick={() => setInfo(null)} className="text-blue-400">✕</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {([
          { key: 'pending', label: 'Ausstehend', color: statusColors.pending },
          { key: 'approved', label: 'Genehmigt', color: statusColors.approved },
          { key: 'rejected', label: 'Abgelehnt', color: statusColors.rejected },
          { key: 'needs_edit', label: 'Bearbeitung', color: statusColors.needs_edit },
        ] as const).map(s => (
          <button
            key={s.key}
            onClick={() => { setStatusFilter(s.key); setPage(1) }}
            className={`rounded-lg border p-4 text-left transition-all ${s.color} ${
              statusFilter === s.key ? 'ring-2 ring-offset-1 ring-blue-400' : ''
            }`}
          >
            <p className="text-xs opacity-70 mb-1">{s.label}</p>
            <p className="text-2xl font-medium">{stats[s.key]}</p>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-gray-700">
              {statusLabels[statusFilter] || 'Alle'} ({count})
            </h2>
            <button
              onClick={() => { setStatusFilter('all'); setPage(1) }}
              className={`rounded-md px-2 py-1 text-xs ${
                statusFilter === 'all' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Alle
            </button>
          </div>

          {selected.size > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">{selected.size} gewählt:</span>
              <button onClick={() => handleBulk('approve')} className="rounded-md bg-green-600 px-2.5 py-1 text-xs text-white hover:bg-green-700">✓ Erledigen</button>
              <button onClick={() => handleBulk('reject')} className="rounded-md bg-red-500 px-2.5 py-1 text-xs text-white hover:bg-red-600">✕ Ablehnen</button>
              <button onClick={() => handleBulk('delete')} className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50">Löschen</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Laden…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-500 mb-2">Keine Einträge</p>
          </div>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.size === items.length && items.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-gray-300"
              />
              <span className="text-xs text-gray-400">Alle auswählen</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {items.map(item => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1 rounded border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-gray-800">{item.title}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[item.status]}`}>
                          {statusLabels[item.status]}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${procStateColors[item.processing_state] ?? 'bg-gray-100 text-gray-600'}`}>
                          {item.processing_state}
                        </span>
                        {item.rss_feeds?.name && (
                          <span className="text-[11px] text-gray-500">{item.rss_feeds.name}</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-1 text-xs text-gray-600 line-clamp-2">{item.description}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-400">
                        <span>{formatDate(item.created_at)}</span>
                        {item.published_at && <span>publ. {formatDate(item.published_at)}</span>}
                        {item.source_url && (
                          <a href={item.source_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                            Quelle ↗
                          </a>
                        )}
                      </div>
                      {item.processing_error && (
                        <p className="mt-1 text-xs text-red-600">⚠ {item.processing_error}</p>
                      )}

                      {expandedId === item.id && (
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <CandidateList itemId={item.id} onChanged={loadItems} />
                          <div className="mt-3 flex gap-2 flex-wrap">
                            <button
                              onClick={() => setPickerOpen(item.id)}
                              className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                            >
                              + Topic manuell zuordnen
                            </button>
                            <button
                              onClick={() => handleReclassify(item.id)}
                              disabled={classifyingId === item.id}
                              className="rounded border border-purple-200 px-2 py-1 text-xs text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                            >
                              {classifyingId === item.id ? 'läuft…' : '⟳ Neu klassifizieren'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="rounded border border-gray-200 px-2 py-1 text-[11px] hover:bg-gray-50"
                      >
                        {expandedId === item.id ? 'Weniger' : 'Details'}
                      </button>
                      {item.processing_state === 'pending' && (
                        <button
                          onClick={() => handleClassify(item.id)}
                          disabled={classifyingId === item.id}
                          className="rounded border border-purple-200 px-2 py-1 text-[11px] text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                        >
                          {classifyingId === item.id ? '…' : '🧠 Klassifizieren'}
                        </button>
                      )}
                      {item.status !== 'approved' && (
                        <button
                          onClick={() => handleAction(item.id, 'approved')}
                          className="rounded border border-green-200 px-2 py-1 text-[11px] text-green-700 hover:bg-green-50"
                          title="Als erledigt markieren"
                        >
                          ✓ Erledigt
                        </button>
                      )}
                      {item.status !== 'rejected' && (
                        <button
                          onClick={() => handleAction(item.id, 'rejected')}
                          className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                        >
                          ✕ Ablehnen
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">Seite {page} von {totalPages}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-gray-200 px-2.5 py-1 text-xs disabled:opacity-30 hover:bg-gray-50">←</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border border-gray-200 px-2.5 py-1 text-xs disabled:opacity-30 hover:bg-gray-50">→</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <TopicPicker
        open={pickerOpen !== null}
        onClose={() => setPickerOpen(null)}
        onPick={topic => {
          if (pickerOpen) handleAddManual(pickerOpen, topic.id)
        }}
      />
    </div>
  )
}
