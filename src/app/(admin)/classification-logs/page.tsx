'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

type RunStatus = 'success' | 'failed' | 'parse_error' | 'pending'

interface ClassificationRun {
  id: string
  incoming_item_id: string | null
  item_title: string | null
  model: string | null
  status: RunStatus
  duration_ms: number | null
  error_message: string | null
  created_at: string
}

interface Pagination {
  page: number
  pageSize: number
  total: number
}

const statusColors: Record<RunStatus, string> = {
  success: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  parse_error: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
}

const statusLabels: Record<RunStatus, string> = {
  success: 'Erfolgreich',
  failed: 'Fehlgeschlagen',
  parse_error: 'Parse-Fehler',
  pending: 'Ausstehend',
}

function formatDuration(ms: number | null) {
  if (ms == null) return '–'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function ClassificationLogsPage() {
  const [runs, setRuns] = useState<ClassificationRun[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedRun, setExpandedRun] = useState<Record<string, unknown> | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/classification-runs?${params}`)
      const json = await res.json()
      if (res.ok) {
        setRuns(json.data ?? [])
        setPagination(json.pagination)
      } else {
        setError(json.error)
      }
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (run: ClassificationRun) => {
    if (expandedId === run.id) {
      setExpandedId(null)
      setExpandedRun(null)
      return
    }
    setExpandedId(run.id)
    setExpandedRun(null)
    if (!run.id) return
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/classification-runs/${run.id}`)
      const json = await res.json()
      if (res.ok) setExpandedRun(json.data)
    } finally {
      setLoadingDetail(false)
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.pageSize)

  return (
    <div>
      <PageHeader
        title="KI-Klassifizierungslogs"
        description="Alle Klassifizierungsläufe mit Status, Dauer und KI-Antworten"
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">✕</button>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-gray-500">Status:</span>
        {(['', 'success', 'failed', 'parse_error'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`rounded-md border px-3 py-1 text-xs transition-colors ${
              statusFilter === s
                ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === '' ? 'Alle' : statusLabels[s as RunStatus]}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">
          {pagination.total} Einträge
        </span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_100px_80px_36px] gap-3 border-b border-gray-100 px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50">
          <span>Item</span>
          <span>Modell</span>
          <span>Zeit</span>
          <span>Dauer</span>
          <span></span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">Laden…</div>
        ) : runs.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Noch keine Klassifizierungsläufe vorhanden.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {runs.map(run => (
              <li key={run.id}>
                <div className="grid grid-cols-[1fr_120px_100px_80px_36px] gap-3 items-center px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-800">
                      {run.item_title ?? <span className="text-gray-400 italic">kein Titel</span>}
                    </p>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium mt-0.5 ${statusColors[run.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {statusLabels[run.status] ?? run.status}
                    </span>
                    {run.error_message && (
                      <p className="mt-0.5 text-xs text-red-600 truncate">{run.error_message}</p>
                    )}
                  </div>
                  <span className="font-mono text-xs text-gray-600 truncate">
                    {run.model ?? '–'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(run.created_at)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDuration(run.duration_ms)}
                  </span>
                  <button
                    onClick={() => toggleExpand(run)}
                    className="rounded border border-gray-200 px-1.5 py-1 text-[11px] hover:bg-gray-50"
                    title="Details anzeigen"
                  >
                    {expandedId === run.id ? '▲' : '▼'}
                  </button>
                </div>

                {expandedId === run.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    {loadingDetail ? (
                      <p className="text-xs text-gray-400">Lade Details…</p>
                    ) : expandedRun ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-gray-500 mb-0.5">Run-ID</p>
                            <p className="font-mono text-gray-700 break-all">{run.id}</p>
                          </div>
                          {run.incoming_item_id && (
                            <div>
                              <p className="text-gray-500 mb-0.5">Item-ID</p>
                              <p className="font-mono text-gray-700 break-all">{run.incoming_item_id}</p>
                            </div>
                          )}
                        </div>
                        {(expandedRun as { prompt?: string }).prompt && (
                          <details>
                            <summary className="cursor-pointer text-xs text-gray-500 select-none">Prompt anzeigen</summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-900 p-3 text-[11px] text-gray-100 whitespace-pre-wrap">
                              {(expandedRun as { prompt: string }).prompt}
                            </pre>
                          </details>
                        )}
                        {(expandedRun as { raw_response?: string }).raw_response && (
                          <details>
                            <summary className="cursor-pointer text-xs text-gray-500 select-none">Rohantwort (LLM)</summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-900 p-3 text-[11px] text-gray-100 whitespace-pre-wrap">
                              {(expandedRun as { raw_response: string }).raw_response}
                            </pre>
                          </details>
                        )}
                        {(expandedRun as { parsed_response?: unknown }).parsed_response != null && (
                          <details open>
                            <summary className="cursor-pointer text-xs text-gray-500 select-none">Geparste JSON-Kandidaten</summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-900 p-3 text-[11px] text-gray-100">
                              {JSON.stringify((expandedRun as { parsed_response: unknown }).parsed_response, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Keine Detaildaten verfügbar.</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">Seite {page} von {totalPages}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-gray-200 px-2.5 py-1 text-xs disabled:opacity-30 hover:bg-gray-50"
              >←</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-gray-200 px-2.5 py-1 text-xs disabled:opacity-30 hover:bg-gray-50"
              >→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
