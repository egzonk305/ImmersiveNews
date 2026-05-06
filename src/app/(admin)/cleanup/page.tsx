'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

interface PreviewData {
  pendingItems: number
  classificationLogs: number
  enrichmentCache: number
  rejectedTopics: number
}

interface ConfirmState {
  title: string
  description: string
  onConfirm: () => Promise<void>
}

function CleanupCard({
  title,
  description,
  count,
  countLabel,
  children,
}: {
  title: string
  description: string
  count: number
  countLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          count > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-500'
        }`}>
          {count} {countLabel}
        </span>
      </div>
      {children}
    </div>
  )
}

export default function CleanupPage() {
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Pending-Items Filter
  const [pendingDays, setPendingDays] = useState(7)
  const [pendingOnlyWithoutTopic, setPendingOnlyWithoutTopic] = useState(false)

  // Log-Filter
  const [logDays, setLogDays] = useState(14)
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'failed_only'>('all')

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setPreviewError(null)
    try {
      const res = await fetch('/api/cleanup/preview')
      const json = await res.json()
      if (res.ok) setPreview(json.data)
    } catch {
      setPreviewError('Vorschau konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPreview() }, [loadPreview])

  const runAction = async (url: string, body: Record<string, unknown>) => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unbekannter Fehler')
      setResult(`${json.data.affected} Einträge bereinigt.`)
      await loadPreview()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
      setConfirm(null)
    }
  }

  const ask = (state: ConfirmState) => {
    setResult(null)
    setError(null)
    setConfirm(state)
  }

  return (
    <div>
      <PageHeader
        title="Aufräumen"
        description="Alte Daten, Logs und Cache-Einträge bereinigen"
        icon="🗑"
      />

      {result && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex justify-between">
          <span>✓ {result}</span>
          <button onClick={() => setResult(null)} className="text-green-400">✕</button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">✕</button>
        </div>
      )}
      {previewError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ⚠ {previewError}
        </div>
      )}

      {/* Bestätigungs-Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{confirm.title}</h3>
            <p className="text-sm text-gray-600 mb-5">{confirm.description}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={confirm.onConfirm}
                disabled={running}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {running ? 'Läuft…' : 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Pending Items */}
        <CleanupCard
          title="Pending-Artikel bereinigen"
          description="Items mit Status 'Ausstehend' die älter als X Tage sind"
          count={loading ? 0 : (preview?.pendingItems ?? 0)}
          countLabel="Items"
        >
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Älter als
              <input
                type="number"
                min={1}
                max={365}
                value={pendingDays}
                onChange={e => setPendingDays(Number(e.target.value))}
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
              />
              Tage
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={pendingOnlyWithoutTopic}
                onChange={e => setPendingOnlyWithoutTopic(e.target.checked)}
              />
              Nur ohne Topic-Zuordnung
            </label>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => ask({
                  title: 'Artikel ablehnen?',
                  description: 'Alle betroffenen Items werden auf \'Abgelehnt\' gesetzt.',
                  onConfirm: () => runAction('/api/cleanup/pending-items', { olderThanDays: pendingDays, action: 'reject', onlyWithoutTopic: pendingOnlyWithoutTopic }),
                })}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Ablehnen
              </button>
              <button
                onClick={() => ask({
                  title: 'Artikel löschen?',
                  description: 'Die gefilterten Items werden unwiderruflich gelöscht.',
                  onConfirm: () => runAction('/api/cleanup/pending-items', { olderThanDays: pendingDays, action: 'delete', onlyWithoutTopic: pendingOnlyWithoutTopic }),
                })}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                Löschen
              </button>
            </div>
          </div>
        </CleanupCard>

        {/* Classification Logs */}
        <CleanupCard
          title="KI-Klassifizierungs-Logs bereinigen"
          description="Alte classification_runs Einträge inkl. verwaister Prompts löschen"
          count={loading ? 0 : (preview?.classificationLogs ?? 0)}
          countLabel="Logs"
        >
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Älter als
              <input
                type="number"
                min={1}
                max={365}
                value={logDays}
                onChange={e => setLogDays(Number(e.target.value))}
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
              />
              Tage
            </label>
            <select
              value={logStatusFilter}
              onChange={e => setLogStatusFilter(e.target.value as 'all' | 'failed_only')}
              className="rounded border border-gray-200 px-2 py-1 text-xs"
            >
              <option value="all">Alle Status</option>
              <option value="failed_only">Nur fehlgeschlagene</option>
            </select>
            <button
              onClick={() => ask({
                title: 'KI-Logs löschen?',
                description: 'Die gefilterten Log-Einträge werden unwiderruflich gelöscht.',
                onConfirm: () => runAction('/api/cleanup/classification-logs', { olderThanDays: logDays, statusFilter: logStatusFilter }),
              })}
              className="ml-auto rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              Löschen
            </button>
          </div>
        </CleanupCard>

        {/* Enrichment Cache */}
        <CleanupCard
          title="Enrichment-Cache leeren"
          description="Gecachte Artikel-Volltexte aus der enrichment_cache Tabelle entfernen"
          count={loading ? 0 : (preview?.enrichmentCache ?? 0)}
          countLabel="Einträge"
        >
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => ask({
                title: 'Nur fehlgeschlagene leeren?',
                description: 'Alle Cache-Einträge mit Status "failed" werden gelöscht.',
                onConfirm: () => runAction('/api/cleanup/enrichment-cache', { scope: 'failed_only' }),
              })}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              Nur fehlgeschlagene
            </button>
            <button
              onClick={() => ask({
                title: 'Gesamten Cache leeren?',
                description: 'Alle Cache-Einträge werden gelöscht. Zukünftige Klassifizierungen holen Inhalte neu.',
                onConfirm: () => runAction('/api/cleanup/enrichment-cache', { scope: 'all' }),
              })}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              Alle leeren
            </button>
          </div>
        </CleanupCard>

        {/* Rejected Topics */}
        <CleanupCard
          title="Abgelehnte Topics löschen"
          description="Topics mit Status 'Abgelehnt' die nicht von Artikeln referenziert werden"
          count={loading ? 0 : (preview?.rejectedTopics ?? 0)}
          countLabel="Topics"
        >
          <div className="mt-3">
            <button
              onClick={() => ask({
                title: 'Abgelehnte Topics löschen?',
                description: 'Nicht referenzierte, abgelehnte Topics werden gelöscht.',
                onConfirm: () => runAction('/api/cleanup/rejected-topics', {}),
              })}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              Löschen
            </button>
          </div>
        </CleanupCard>

      </div>
    </div>
  )
}
