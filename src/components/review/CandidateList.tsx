'use client'

import { useEffect, useState } from 'react'

export interface CandidateRow {
  id: string
  topic_id: string
  rank: number
  confidence: number | null
  is_primary: boolean
  reason: string | null
  source: 'llm' | 'manual'
  status: 'suggested' | 'confirmed' | 'rejected'
  topics?: { id: string; name: string; level: number; full_path?: string | null } | null
}

interface Props {
  itemId: string
  onChanged?: () => void
}

const statusColors = {
  suggested: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-green-50 text-green-700 border border-green-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
}

const sourceColors = {
  llm: 'bg-purple-50 text-purple-700 border border-purple-200',
  manual: 'bg-blue-50 text-blue-700 border border-blue-200',
}

export function CandidateList({ itemId, onChanged }: Props) {
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/review/${itemId}/candidates`)
      const json = await res.json()
      if (res.ok) setCandidates(json.data ?? [])
      else setError(json.error)
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [itemId])

  const action = async (
    candidateId: string,
    body: Record<string, unknown>
  ) => {
    setBusyId(candidateId)
    try {
      const res = await fetch(`/api/review/${itemId}/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        setError(j.error)
      } else {
        await load()
        onChanged?.()
      }
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (candidateId: string) => {
    if (!confirm('Zuordnung entfernen?')) return
    setBusyId(candidateId)
    try {
      const res = await fetch(`/api/review/${itemId}/candidates/${candidateId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json()
        setError(j.error)
      } else {
        await load()
        onChanged?.()
      }
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 py-1">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded border border-gray-200 p-3">
            <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
            <div className="mt-2 h-2 w-1/3 rounded bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center">
        <p className="text-xs text-gray-500 mb-1">Keine KI-Kandidaten vorhanden</p>
        <p className="text-[11px] text-gray-400">
          Klassifizierung starten oder manuell zuordnen.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {candidates
        .sort((a, b) =>
          a.is_primary === b.is_primary ? a.rank - b.rank : a.is_primary ? -1 : 1
        )
        .map(c => (
          <div
            key={c.id}
            className={`rounded border p-3 text-sm ${
              c.is_primary ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-800">
                    {c.topics?.full_path ?? c.topics?.name ?? '(unbekanntes Topic)'}
                  </span>
                  {c.is_primary && (
                    <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
                      PRIMARY
                    </span>
                  )}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${sourceColors[c.source]}`}>
                    {c.source === 'llm' ? 'KI' : 'manuell'}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${statusColors[c.status]}`}>
                    {c.status === 'suggested' ? 'Vorschlag' : c.status === 'confirmed' ? 'bestätigt' : 'abgelehnt'}
                  </span>
                </div>
                {c.confidence !== null && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 max-w-[140px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          c.confidence >= 0.8 ? 'bg-green-500' :
                          c.confidence >= 0.5 ? 'bg-amber-500' :
                          'bg-red-400'
                        }`}
                        style={{ width: `${c.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 tabular-nums">
                      {(c.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {c.reason && (
                  <p className="mt-1 text-xs text-gray-600 italic">{c.reason}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {c.status !== 'confirmed' && (
                  <button
                    disabled={busyId === c.id}
                    onClick={() => action(c.id, { status: 'confirmed', is_primary: c.is_primary })}
                    className="rounded border border-green-200 px-2 py-1 text-[11px] text-green-700 hover:bg-green-50 disabled:opacity-50"
                    title="Annehmen"
                  >
                    ✓
                  </button>
                )}
                {c.status !== 'rejected' && (
                  <button
                    disabled={busyId === c.id}
                    onClick={() => action(c.id, { status: 'rejected' })}
                    className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="Ablehnen"
                  >
                    ✕
                  </button>
                )}
                {!c.is_primary && c.status !== 'rejected' && (
                  <button
                    disabled={busyId === c.id}
                    onClick={() => action(c.id, { is_primary: true })}
                    className="rounded border border-blue-200 px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    title="Als primary setzen"
                  >
                    ★
                  </button>
                )}
                <button
                  disabled={busyId === c.id}
                  onClick={() => remove(c.id)}
                  className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                  title="Entfernen"
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))}
    </div>
  )
}
