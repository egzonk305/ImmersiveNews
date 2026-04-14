'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import type { RssFeed } from '@/lib/types/database.types'

const intervalLabels: Record<string, string> = {
  '15min': 'Alle 15 Min.',
  hourly: 'Stündlich',
  '6hours': 'Alle 6 Std.',
  daily: 'Täglich',
}

export default function FeedsSettingsPage() {
  const [feeds, setFeeds] = useState<RssFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Formular
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formInterval, setFormInterval] = useState<string>('hourly')
  const [saving, setSaving] = useState(false)

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Fetch-Status
  const [fetchingId, setFetchingId] = useState<string | null>(null)
  const [fetchResult, setFetchResult] = useState<{ id: string; msg: string } | null>(null)

  const loadFeeds = useCallback(async () => {
    try {
      const res = await fetch('/api/feeds')
      const json = await res.json()
      if (res.ok) {
        setFeeds(json.data ?? [])
      } else {
        setError(json.error)
      }
    } catch {
      setError('Fehler beim Laden der Feeds')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFeeds() }, [loadFeeds])

  const handleCreate = async () => {
    if (!formName.trim() || !formUrl.trim()) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          url: formUrl.trim(),
          interval: formInterval,
        }),
      })
      const json = await res.json()

      if (res.ok) {
        setShowForm(false)
        setFormName('')
        setFormUrl('')
        setFormInterval('hourly')
        loadFeeds()
      } else {
        setError(json.error)
      }
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Feed wirklich löschen? Zugehörige Queue-Einträge werden ebenfalls entfernt.')) return

    try {
      const res = await fetch(`/api/feeds/${id}`, { method: 'DELETE' })
      if (res.ok) loadFeeds()
      else {
        const json = await res.json()
        setError(json.error)
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const handleToggleActive = async (feed: RssFeed) => {
    try {
      const res = await fetch(`/api/feeds/${feed.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !feed.is_active }),
      })
      if (res.ok) loadFeeds()
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const handleRename = async (id: string) => {
    if (!editName.trim()) return
    try {
      const res = await fetch(`/api/feeds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (res.ok) {
        setEditingId(null)
        loadFeeds()
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const handleFetch = async (id: string) => {
    setFetchingId(id)
    setFetchResult(null)
    try {
      const res = await fetch(`/api/feeds/${id}/fetch`, { method: 'POST' })
      const json = await res.json()

      if (res.ok) {
        setFetchResult({
          id,
          msg: `${json.data.new_items_added} neue Items (${json.data.duplicates_skipped} Duplikate übersprungen)`,
        })
        loadFeeds()
      } else {
        setFetchResult({ id, msg: `Fehler: ${json.error}` })
      }
    } catch {
      setFetchResult({ id, msg: 'Netzwerkfehler beim Abrufen' })
    } finally {
      setFetchingId(null)
    }
  }

  const handleIntervalChange = async (id: string, interval: string) => {
    try {
      await fetch(`/api/feeds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      loadFeeds()
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const formatDate = (d: string | null) => {
    if (!d) return '–'
    return new Date(d).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div>
      <PageHeader
        title="Feed-Einstellungen"
        description="RSS-Feeds und externe Quellen konfigurieren"
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="max-w-3xl space-y-6">
        {/* Aktive Feeds */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">
              Feeds ({feeds.length})
            </h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 transition-colors"
            >
              {showForm ? 'Abbrechen' : '+ Feed hinzufügen'}
            </button>
          </div>

          {/* Neuer Feed Formular */}
          {showForm && (
            <div className="border-b border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="z.B. Heise News"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Feed-URL</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.com/rss.xml"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Intervall</label>
                  <select
                    value={formInterval}
                    onChange={(e) => setFormInterval(e.target.value)}
                    className="rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="15min">Alle 15 Min.</option>
                    <option value="hourly">Stündlich</option>
                    <option value="6hours">Alle 6 Std.</option>
                    <option value="daily">Täglich</option>
                  </select>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={saving || !formName.trim() || !formUrl.trim()}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Speichern…' : 'Speichern'}
                </button>
              </div>
            </div>
          )}

          {/* Feed-Liste */}
          {loading ? (
            <div className="p-10 text-center text-sm text-gray-400">Laden…</div>
          ) : feeds.length === 0 ? (
            <div className="p-10 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <span className="text-xl text-gray-400">⟳</span>
              </div>
              <p className="text-sm text-gray-500 mb-2">Noch keine Feeds konfiguriert</p>
              <p className="text-xs text-gray-400">
                Füge RSS-Feeds hinzu, um automatisch neue Inhalte in die Review-Queue zu bekommen.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {feeds.map((feed) => (
                <div key={feed.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {editingId === feed.id ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(feed.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            autoFocus
                            className="flex-1 rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button onClick={() => handleRename(feed.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">OK</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Abb.</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-1">
                          <h3
                            className="text-sm font-medium text-gray-800 cursor-pointer hover:text-blue-600"
                            onDoubleClick={() => { setEditingId(feed.id); setEditName(feed.name) }}
                            title="Doppelklick zum Bearbeiten"
                          >
                            {feed.name}
                          </h3>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            feed.is_active
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}>
                            {feed.is_active ? 'Aktiv' : 'Pausiert'}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 truncate mb-2">{feed.url}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{feed.item_count} Items</span>
                        <span>Zuletzt: {formatDate(feed.last_fetched_at)}</span>
                        <select
                          value={feed.interval}
                          onChange={(e) => handleIntervalChange(feed.id, e.target.value)}
                          className="rounded border border-gray-200 px-2 py-0.5 text-xs bg-white"
                        >
                          {Object.entries(intervalLabels).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                      {feed.last_error && (
                        <p className="mt-1 text-xs text-red-500">Fehler: {feed.last_error}</p>
                      )}
                      {fetchResult?.id === feed.id && (
                        <p className={`mt-1 text-xs ${fetchResult.msg.startsWith('Fehler') ? 'text-red-500' : 'text-green-600'}`}>
                          {fetchResult.msg}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleFetch(feed.id)}
                        disabled={fetchingId === feed.id}
                        className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                        title="Jetzt abrufen"
                      >
                        {fetchingId === feed.id ? '⟳…' : '⟳ Abrufen'}
                      </button>
                      <button
                        onClick={() => handleToggleActive(feed)}
                        className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        {feed.is_active ? '⏸' : '▶'}
                      </button>
                      <button
                        onClick={() => handleDelete(feed.id)}
                        className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
