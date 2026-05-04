'use client'
import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import type { PendingTopicSuggestion } from '@/lib/types/database.types'

export default function TopicSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<PendingTopicSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/topic-suggestions')
      const data = await res.json()
      setSuggestions(Array.isArray(data) ? data : [])
    } catch {
      setError('Fehler beim Laden der Vorschläge')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/topic-suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        const actionLabel = action === 'approve' ? 'angenommen' : 'abgelehnt'
        setInfo(`Topic ${actionLabel}.`)
        setSuggestions(prev => prev.filter(s => s.id !== id))
      } else {
        const json = await res.json()
        setError(json.error || 'Fehler beim Verarbeiten')
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  return (
    <div>
      <PageHeader
        title="Topic-Vorschläge"
        description="Von der KI vorgeschlagene Topics annehmen oder ablehnen"
        icon="💡"
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

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <ul className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="px-4 py-3.5 flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/5 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-4/5 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-2/5 rounded bg-gray-100 animate-pulse" />
                </div>
              </li>
            ))}
          </ul>
        ) : suggestions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex w-12 h-12 rounded-full bg-gray-100 items-center justify-center mb-3 text-gray-400 text-xl">
              ✨
            </div>
            <p className="text-sm text-gray-700 font-medium mb-1">Keine offenen Vorschläge</p>
            <p className="text-xs text-gray-500">
              Alle vorgeschlagenen Topics wurden bereits genehmigt oder abgelehnt.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {suggestions.map(s => (
              <li key={s.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium text-gray-800 text-sm">{s.name}</p>
                    {s.parent_full_path && (
                      <p className="text-xs text-gray-600">
                        unter: <span className="font-mono text-gray-500">{s.parent_full_path}</span>
                      </p>
                    )}
                    {s.proposed_from_item_title && (
                      <p className="text-xs text-gray-500">
                        Quelle: <span className="text-gray-600">{s.proposed_from_item_title}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      {new Date(s.created_at).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAction(s.id, 'approve')}
                      className="rounded px-3 py-1.5 bg-green-600 text-white text-sm hover:bg-green-700 transition-colors font-medium"
                    >
                      ✓ Annehmen
                    </button>
                    <button
                      onClick={() => handleAction(s.id, 'reject')}
                      className="rounded px-3 py-1.5 bg-red-600 text-white text-sm hover:bg-red-700 transition-colors font-medium"
                    >
                      ✕ Ablehnen
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
