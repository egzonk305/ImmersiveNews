'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import type { IncomingItem } from '@/lib/types/database.types'

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

const sourceLabels: Record<string, string> = {
  manual: 'Manuell',
  import_csv: 'CSV',
  import_json: 'JSON',
  rss: 'RSS',
  api: 'API',
  xml: 'XML',
}

export default function ReviewPage() {
  const [items, setItems] = useState<ItemWithFeed[]>([])
  const [stats, setStats] = useState<ReviewStats>({ pending: 0, approved: 0, rejected: 0, needs_edit: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [sourceFilter, setSourceFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<{ id: string; title: string } | null>(null)
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
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
      if (sourceFilter) params.set('source', sourceFilter)

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
  }, [statusFilter, sourceFilter, page])

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
        loadItems()
        loadStats()
      } else {
        const json = await res.json()
        setError(json.error)
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eintrag endgültig löschen?')) return
    try {
      const res = await fetch(`/api/review/${id}`, { method: 'DELETE' })
      if (res.ok) {
        loadItems()
        loadStats()
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const handleBulk = async (action: 'approve' | 'reject' | 'delete') => {
    if (selected.size === 0) return
    if (action === 'delete' && !confirm(`${selected.size} Einträge endgültig löschen?`)) return

    try {
      const res = await fetch('/api/review/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      })
      if (res.ok) {
        setSelected(new Set())
        loadItems()
        loadStats()
      } else {
        const json = await res.json()
        setError(json.error)
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const handleRename = async (id: string, title: string) => {
    if (!title.trim()) return
    try {
      const res = await fetch(`/api/review/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), status: 'pending' }),
      })
      if (res.ok) {
        setEditingItem(null)
        loadItems()
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
        description="Eingehende Inhalte prüfen und einordnen"
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Stats */}
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

      {/* Queue */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-gray-700">
              {statusLabels[statusFilter] || 'Alle'} ({count})
            </h2>
            <button
              onClick={() => { setStatusFilter('all'); setPage(1) }}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                statusFilter === 'all' ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Alle
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs bg-white"
            >
              <option value="">Alle Quellen</option>
              {Object.entries(sourceLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            {selected.size > 0 && (
              <div className="flex items-center gap-1 ml-2">
                <span className="text-xs text-gray-500">{selected.size} gewählt:</span>
                <button
                  onClick={() => handleBulk('approve')}
                  className="rounded-md bg-green-600 px-2.5 py-1 text-xs text-white hover:bg-green-700"
                >
                  ✓ Genehmigen
                </button>
                <button
                  onClick={() => handleBulk('reject')}
                  className="rounded-md bg-red-500 px-2.5 py-1 text-xs text-white hover:bg-red-600"
                >
                  ✕ Ablehnen
                </button>
                <button
                  onClick={() => handleBulk('delete')}
                  className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  Löschen
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Laden…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
              <span className="text-xl text-gray-400">✓</span>
            </div>
            <p className="text-sm text-gray-500 mb-2">Keine Einträge</p>
            <p className="text-xs text-gray-400">
              {statusFilter === 'pending'
                ? 'Keine ausstehenden Einträge. Neue Einträge aus Feeds erscheinen hier.'
                : 'Keine Einträge mit diesem Filter gefunden.'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === items.length && items.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-3 py-2.5">Titel</th>
                  <th className="px-3 py-2.5 w-24">Quelle</th>
                  <th className="px-3 py-2.5 w-24">Status</th>
                  <th className="px-3 py-2.5 w-32">Erstellt</th>
                  <th className="px-3 py-2.5 w-40">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(item => (
                  <tr
                    key={item.id}
                    className={`group hover:bg-gray-50/50 transition-colors ${selected.has(item.id) ? 'bg-blue-50/30' : ''}`}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      {editingItem?.id === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingItem.title}
                            onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(item.id, editingItem.title)
                              if (e.key === 'Escape') setEditingItem(null)
                            }}
                            autoFocus
                            className="flex-1 rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button onClick={() => handleRename(item.id, editingItem.title)} className="text-xs text-blue-600 font-medium">OK</button>
                          <button onClick={() => setEditingItem(null)} className="text-xs text-gray-400">Abb.</button>
                        </div>
                      ) : (
                        <div>
                          <p
                            className="text-gray-800 cursor-pointer hover:text-blue-600"
                            onDoubleClick={() => setEditingItem({ id: item.id, title: item.title })}
                            title="Doppelklick zum Bearbeiten"
                          >
                            {item.title}
                          </p>
                          {expandedId === item.id && item.description && (
                            <p className="mt-1 text-xs text-gray-400 line-clamp-3">{item.description}</p>
                          )}
                          {item.source_url && (
                            <button
                              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                              className="text-[10px] text-gray-400 hover:text-gray-600 mt-0.5"
                            >
                              {expandedId === item.id ? 'Weniger ▲' : 'Details ▼'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-gray-500">
                        {item.rss_feeds?.name || sourceLabels[item.source_type] || item.source_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[item.status]}`}>
                        {statusLabels[item.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {item.status !== 'approved' && (
                          <button
                            onClick={() => handleAction(item.id, 'approved')}
                            className="rounded border border-green-200 px-2 py-1 text-[10px] text-green-600 hover:bg-green-50 transition-colors"
                            title="Genehmigen & als Topic anlegen"
                          >
                            ✓
                          </button>
                        )}
                        {item.status !== 'rejected' && (
                          <button
                            onClick={() => handleAction(item.id, 'rejected')}
                            className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-500 hover:bg-red-50 transition-colors"
                          >
                            ✕
                          </button>
                        )}
                        {item.status !== 'needs_edit' && (
                          <button
                            onClick={() => handleAction(item.id, 'needs_edit')}
                            className="rounded border border-blue-200 px-2 py-1 text-[10px] text-blue-500 hover:bg-blue-50 transition-colors"
                            title="Zur Bearbeitung markieren"
                          >
                            ✎
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="rounded border border-gray-200 px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">Seite {page} von {totalPages}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded border border-gray-200 px-2.5 py-1 text-xs disabled:opacity-30 hover:bg-gray-50"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded border border-gray-200 px-2.5 py-1 text-xs disabled:opacity-30 hover:bg-gray-50"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
