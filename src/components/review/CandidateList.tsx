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
          <div key={i} className="rounded-xl border border-white/60 bg-white/40 p-3">
            <div className="h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
            <div className="mt-2 h-2 w-1/3 rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200/60 bg-white/30 px-4 py-6 text-center">
        <p className="text-xs text-slate-500 mb-1">Keine KI-Kandidaten vorhanden</p>
        <p className="text-[11px] text-slate-400">
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
            className={`rounded-xl border p-3 text-sm ${
              c.is_primary
                ? 'border-violet-200/60 bg-violet-50/40'
                : 'border-white/60 bg-white/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-800">
                    {c.topics?.full_path ?? c.topics?.name ?? '(unbekanntes Topic)'}
                  </span>
                  {c.is_primary && (
                    <span className="rounded-md px-1.5 py-0.5 text-[10px] text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      PRIMARY
                    </span>
                  )}
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${sourceColors[c.source]}`}>
                    {c.source === 'llm' ? 'KI' : 'manuell'}
                  </span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${statusColors[c.status]}`}>
                    {c.status === 'suggested' ? 'Vorschlag' : c.status === 'confirmed' ? 'bestätigt' : 'abgelehnt'}
                  </span>
                </div>
                {c.confidence !== null && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 max-w-[140px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          c.confidence >= 0.8 ? 'bg-green-500' :
                          c.confidence >= 0.5 ? 'bg-amber-500' :
                          'bg-red-400'
                        }`}
                        style={{ width: `${c.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      {(c.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {c.reason && (
                  <p className="mt-1 text-xs text-slate-500 italic">{c.reason}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {c.status !== 'confirmed' && (
                  <button
                    disabled={busyId === c.id}
                    onClick={() => action(c.id, { status: 'confirmed', is_primary: c.is_primary })}
                    className="rounded-lg border border-green-200/60 bg-green-50/60 px-2 py-1 text-[11px] text-green-700 hover:bg-green-100/60 disabled:opacity-50"
                    title="Annehmen"
                  >
                    ✓
                  </button>
                )}
                {c.status !== 'rejected' && (
                  <button
                    disabled={busyId === c.id}
                    onClick={() => action(c.id, { status: 'rejected' })}
                    className="rounded-lg border border-red-200/60 bg-red-50/60 px-2 py-1 text-[11px] text-red-600 hover:bg-red-100/60 disabled:opacity-50"
                    title="Ablehnen"
                  >
                    ✕
                  </button>
                )}
                {!c.is_primary && c.status !== 'rejected' && (
                  <button
                    disabled={busyId === c.id}
                    onClick={() => action(c.id, { is_primary: true })}
                    className="rounded-lg border border-violet-200/60 bg-violet-50/60 px-2 py-1 text-[11px] text-violet-600 hover:bg-violet-100/60 disabled:opacity-50"
                    title="Als primary setzen"
                  >
                    ★
                  </button>
                )}
                <button
                  disabled={busyId === c.id}
                  onClick={() => remove(c.id)}
                  className="rounded-lg border border-slate-200/60 bg-white/40 px-2 py-1 text-[11px] text-slate-400 hover:bg-white/80 disabled:opacity-50"
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
