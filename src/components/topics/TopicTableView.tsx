'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn, levelLabel, formatDate } from '@/lib/utils'
import type { Topic } from '@/lib/types/database.types'

interface TopicTableViewProps {
  initialData: Topic[]
  initialCount: number
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-purple-100 text-purple-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-teal-100 text-teal-700',
  4: 'bg-amber-100 text-amber-700',
  5: 'bg-green-100 text-green-700',
}

export function TopicTableView({ initialData, initialCount }: TopicTableViewProps) {
  const router = useRouter()
  const [data, setData] = useState<Topic[]>(initialData)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 25

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (levelFilter) params.set('level', String(levelFilter))
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/topics?${params}`)
      const json = await res.json()
      setData(json.data ?? [])
      setCount(json.count ?? 0)
    } catch {
      setError('Fehler beim Laden der Daten')
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

    for (const id of selected) {
      await fetch(`/api/topics/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
    }

    setSelected(new Set())
    fetchData()
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Suchen…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-64 rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={levelFilter ?? ''}
            onChange={(e) => { setLevelFilter(e.target.value ? Number(e.target.value) : null); setPage(1) }}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Ebenen</option>
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>{levelLabel(l)}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-gray-500">{selected.size} ausgewählt</span>
              <button
                onClick={handleBulkDelete}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
              >
                Auswahl löschen
              </button>
            </>
          )}
          <span className="text-xs text-gray-400">{count} Einträge</span>
        </div>
      </div>

      {/* Fehlermeldung */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2 text-sm text-red-600 flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Tabelle */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selected.size === data.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 w-32">Ebene</th>
                <th className="px-3 py-3 text-left font-medium text-gray-600 w-44">Erstellt</th>
                <th className="px-3 py-3 text-right font-medium text-gray-600 w-36">Aktionen</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y divide-gray-50', loading && 'opacity-50')}>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-gray-400">
                    {loading ? 'Laden…' : 'Keine Einträge gefunden'}
                  </td>
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
                          <span className="text-red-600 text-xs">Wirklich löschen (inkl. Kinder)?</span>
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
                        >
                          {topic.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        LEVEL_COLORS[topic.level] ?? 'bg-gray-100 text-gray-600'
                      )}>
                        {levelLabel(topic.level)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                      {formatDate(topic.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(topic)}
                          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          title="Umbenennen"
                        >
                          Umbenennen
                        </button>
                        <Link
                          href={`/topics/${topic.id}/edit`}
                          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          title="Bearbeiten"
                        >
                          Bearbeiten
                        </Link>
                        <button
                          onClick={() => handleDelete(topic.id)}
                          className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Löschen"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <span className="text-xs text-gray-400">
              Seite {page} von {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-gray-200 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                ← Zurück
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-gray-200 px-3 py-1 text-xs disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Weiter →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
