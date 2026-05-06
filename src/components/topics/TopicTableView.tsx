'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn, levelLabel, formatDate } from '@/lib/utils'
import type { Topic } from '@/lib/types/database.types'

export function TopicTableView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<Topic[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [levelFilter, setLevelFilter] = useState(searchParams.get('level') || '')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (levelFilter) params.set('level', levelFilter)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/topics?${params}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json.data ?? [])
      setCount(json.count ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Daten')
    } finally {
      setLoading(false)
    }
  }, [search, levelFilter, page])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData()
    }, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchData, search])

  const totalPages = Math.ceil(count / pageSize)

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === data.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(data.map((t) => t.id)))
    }
  }

  const startEdit = (topic: Topic) => {
    setEditingId(topic.id)
    setEditName(topic.name)
  }

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (res.ok) {
        setEditingId(null)
        fetchData()
      } else {
        const json = await res.json()
        setError(json.error ?? 'Fehler beim Speichern')
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const handleDelete = async (id: string, force = false) => {
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })

      if (res.status === 409 && !force) {
        setDeleteConfirm(id)
        return
      }

      if (res.ok) {
        setDeleteConfirm(null)
        setSelected(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        fetchData()
        router.refresh()
      } else {
        const json = await res.json()
        setError(json.error ?? 'Fehler beim Löschen')
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`${selected.size} Topics wirklich löschen?`)) return

    setError(null)
    let deleted = 0
    for (const id of selected) {
      try {
        const res = await fetch(`/api/topics/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        })
        if (res.ok) deleted++
      } catch { /* continue */ }
    }

    setSelected(new Set())
    fetchData()
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Suche nach Name…"
            className="w-full rounded-md border border-gray-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">⌕</span>
        </div>

        <select
          value={levelFilter}
          onChange={(e) => { setLevelFilter(e.target.value); setPage(1) }}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
        >
          <option value="">Alle Ebenen</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(l => (
            <option key={l} value={l}>{levelLabel(l)}</option>
          ))}
        </select>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">{selected.size} gewählt</span>
            <button
              onClick={handleBulkDelete}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
            >
              Löschen
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Tabelle */}
      <div className="rounded-xl glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="px-3 py-2.5 w-8">
                <input
                  type="checkbox"
                  checked={selected.size === data.length && data.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5 w-28">Ebene</th>
              <th className="px-3 py-2.5 w-36">Typ</th>
              <th className="px-3 py-2.5 w-28">Nutzung</th>
              <th className="px-3 py-2.5 w-32">Erstellt</th>
              <th className="px-3 py-2.5 w-32">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-400">
                  {search ? `Keine Ergebnisse für „${search}"` : 'Keine Einträge gefunden'}
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-gray-400">Laden…</td>
              </tr>
            ) : (
              data.map((topic) => (
                <tr
                  key={topic.id}
                  className={cn(
                    'group transition-colors hover:bg-gray-50/50',
                    selected.has(topic.id) && 'bg-blue-50/30',
                    deleteConfirm === topic.id && 'bg-red-50/30'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(topic.id)}
                      onChange={() => toggleSelect(topic.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    {editingId === topic.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(topic.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          autoFocus
                          className="flex-1 rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => saveEdit(topic.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Abb.
                        </button>
                      </div>
                    ) : deleteConfirm === topic.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 text-xs">Wirklich löschen (inkl. Unterthemen)?</span>
                        <button
                          onClick={() => handleDelete(topic.id, true)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Ja
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Nein
                        </button>
                      </div>
                    ) : (
                      <Link
                        href={`/topics/${topic.id}`}
                        className="text-gray-800 hover:text-blue-600 transition-colors"
                        onDoubleClick={(e) => {
                          e.preventDefault()
                          startEdit(topic)
                        }}
                        title="Klick = Detail, Doppelklick = Umbenennen"
                      >
                        {topic.name}
                      </Link>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-gray-400">
                      {topic.auto_created && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">auto</span>
                      )}
                      {topic.canonical_name && topic.canonical_name !== topic.name && (
                        <span>{topic.canonical_name}</span>
                      )}
                      {topic.slug && <span>{topic.slug}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                      {levelLabel(topic.level)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    {topic.topic_type ?? 'topic'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{topic.usage_count ?? 0}</span>
                    {topic.last_seen_at && (
                      <span className="block text-[10px] text-gray-400">{formatDate(topic.last_seen_at)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">
                    {formatDate(topic.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(topic)}
                        className="rounded border border-gray-200 px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
                        title="Umbenennen"
                      >
                        ✎
                      </button>
                      <Link
                        href={`/topics/${topic.id}/edit`}
                        className="rounded border border-gray-200 px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 transition-colors"
                        title="Bearbeiten"
                      >
                        ⚙
                      </Link>
                      <button
                        onClick={() => handleDelete(topic.id)}
                        className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-400 hover:bg-red-50 transition-colors"
                        title="Löschen"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {count} Einträge · Seite {page} von {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-30 hover:bg-gray-50"
              >
                ««
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-30 hover:bg-gray-50"
              >
                ←
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-30 hover:bg-gray-50"
              >
                →
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-30 hover:bg-gray-50"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
