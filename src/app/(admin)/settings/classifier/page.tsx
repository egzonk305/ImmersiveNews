'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import type { ClassifierSettings } from '@/lib/types/database.types'

interface TestConnectionResult {
  ok: boolean
  base_url?: string
  configured_model?: string
  model_available?: boolean
  models?: string[]
}

interface TestClassifyResult {
  ok: boolean
  duration_ms?: number
  model?: string
  raw_response?: string
  parsed?: unknown
  schema_valid?: boolean
  schema_error?: string | null
  valid_topic_ids?: number
  total_candidates?: number
}

export default function ClassifierSettingsPage() {
  const [settings, setSettings] = useState<ClassifierSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMessage, setOkMessage] = useState<string | null>(null)

  const [testingConn, setTestingConn] = useState(false)
  const [connResult, setConnResult] = useState<TestConnectionResult | null>(null)
  const [connError, setConnError] = useState<string | null>(null)

  const [testingClassify, setTestingClassify] = useState(false)
  const [classifyResult, setClassifyResult] = useState<TestClassifyResult | null>(null)
  const [classifyError, setClassifyError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/classifier-settings')
      const json = await res.json()
      if (res.ok) setSettings(json.data)
      else setError(json.error)
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const update = (patch: Partial<ClassifierSettings>) => {
    if (!settings) return
    setSettings({ ...settings, ...patch })
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    setOkMessage(null)
    try {
      const res = await fetch('/api/classifier-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ollama_base_url: settings.ollama_base_url,
          model_name: settings.model_name,
          max_candidates: settings.max_candidates,
          max_depth: settings.max_depth,
          confidence_threshold: settings.confidence_threshold,
          auto_accept_enabled: settings.auto_accept_enabled,
          temperature: settings.temperature,
          num_ctx: settings.num_ctx,
          num_predict: settings.num_predict,
          timeout_ms: settings.timeout_ms,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setSettings(json.data)
        setOkMessage('Einstellungen gespeichert.')
      } else {
        setError(json.error)
      }
    } catch {
      setError('Netzwerkfehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    if (!settings) return
    setTestingConn(true)
    setConnError(null)
    setConnResult(null)
    try {
      const res = await fetch('/api/classifier-settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ollama_base_url: settings.ollama_base_url,
          model_name: settings.model_name,
        }),
      })
      const json = await res.json()
      if (res.ok) setConnResult(json.data)
      else setConnError(json.error || 'Verbindung fehlgeschlagen')
    } catch (err) {
      setConnError(err instanceof Error ? err.message : 'Netzwerkfehler')
    } finally {
      setTestingConn(false)
    }
  }

  const testClassify = async () => {
    setTestingClassify(true)
    setClassifyError(null)
    setClassifyResult(null)
    try {
      const res = await fetch('/api/classifier-settings/test-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const json = await res.json()
      if (res.ok) setClassifyResult(json.data)
      else setClassifyError(json.error || 'Test-Klassifizierung fehlgeschlagen')
    } catch (err) {
      setClassifyError(err instanceof Error ? err.message : 'Netzwerkfehler')
    } finally {
      setTestingClassify(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="KI-Einstellungen" description="Lade…" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div>
        <PageHeader title="KI-Einstellungen" description="Konnte Einstellungen nicht laden" />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="KI-Einstellungen"
        description="Lokale Klassifizierung über Ollama (z. B. qwen3:8b)"
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200/60 bg-red-50/60 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {okMessage && (
        <div className="mb-4 rounded-xl border border-green-200/60 bg-green-50/60 px-4 py-3 text-sm text-green-700">
          {okMessage}
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        <section className="rounded-xl glass-card p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700">Modell &amp; Verbindung</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Ollama Base-URL
            </label>
            <input
              type="text"
              value={settings.ollama_base_url}
              onChange={e => update({ ollama_base_url: e.target.value })}
              placeholder="http://localhost:11434"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-300/60 focus:border-violet-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Modellname
            </label>
            <input
              type="text"
              value={settings.model_name}
              onChange={e => update({ model_name: e.target.value })}
              placeholder="qwen3:8b"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-300/60 focus:border-violet-300"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={testConnection}
              disabled={testingConn}
              className="rounded-xl border border-slate-200/60 bg-white/60 px-3 py-1.5 text-xs text-slate-600 hover:bg-white/90 transition-all disabled:opacity-50"
            >
              {testingConn ? 'Teste…' : 'Verbindung testen'}
            </button>
          </div>

          {connError && (
            <p className="text-xs text-red-600">{connError}</p>
          )}
          {connResult && (
            <div className="rounded-xl border border-white/60 bg-white/40 p-3 text-xs">
              <p>
                Verbindung: <b>{connResult.ok ? 'OK' : 'Fehler'}</b>
              </p>
              <p>
                Modell <code>{connResult.configured_model}</code>{' '}
                {connResult.model_available ? '✅ verfügbar' : '⚠ nicht installiert'}
              </p>
              {connResult.models && connResult.models.length > 0 && (
                <p className="mt-1 text-gray-500">
                  Lokal verfügbar: {connResult.models.join(', ')}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl glass-card p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700">Klassifizierungs-Parameter</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Max. Kandidaten
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.max_candidates}
                onChange={e => update({ max_candidates: parseInt(e.target.value, 10) })}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300/60 focus:border-violet-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Max. Tiefe (1–8)
              </label>
              <input
                type="number"
                min={1}
                max={8}
                value={settings.max_depth}
                onChange={e => update({ max_depth: parseInt(e.target.value, 10) })}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300/60 focus:border-violet-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Confidence-Schwelle: {settings.confidence_threshold.toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.confidence_threshold}
              onChange={e => update({ confidence_threshold: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.auto_accept_enabled}
              onChange={e => update({ auto_accept_enabled: e.target.checked })}
            />
            <span>Auto-Accept aktiv (oberhalb der Schwelle)</span>
          </label>
        </section>

        <section className="rounded-xl glass-card p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700">Modell-Parameter</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Temperatur: {settings.temperature.toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.temperature}
              onChange={e => update({ temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Kontext-Fenster (num_ctx)
              </label>
              <input
                type="number"
                min={2048}
                max={32768}
                step={512}
                value={settings.num_ctx}
                onChange={e => update({ num_ctx: parseInt(e.target.value, 10) })}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300/60 focus:border-violet-300"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Max. Tokens (num_predict)
              </label>
              <input
                type="number"
                min={100}
                max={2000}
                step={50}
                value={settings.num_predict}
                onChange={e => update({ num_predict: parseInt(e.target.value, 10) })}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300/60 focus:border-violet-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Timeout (ms)
            </label>
            <input
              type="number"
              min={30000}
              max={600000}
              step={30000}
              value={settings.timeout_ms}
              onChange={e => update({ timeout_ms: parseInt(e.target.value, 10) })}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300/60 focus:border-violet-300"
            />
          </div>
        </section>

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary rounded-xl px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? 'Speichern…' : 'Einstellungen speichern'}
          </button>
          <button
            onClick={testClassify}
            disabled={testingClassify}
            className="rounded-xl border border-slate-200/60 bg-white/60 px-4 py-2 text-sm text-slate-600 hover:bg-white/90 transition-all disabled:opacity-50"
          >
            {testingClassify ? 'Test läuft…' : 'Test-Klassifizierung'}
          </button>
        </div>

        {classifyError && (
          <div className="rounded-xl border border-red-200/60 bg-red-50/60 px-4 py-3 text-sm text-red-700">
            {classifyError}
          </div>
        )}
        {classifyResult && (
          <section className="rounded-xl glass-card p-5 space-y-2 text-sm">
            <h2 className="text-sm font-medium text-gray-700">Test-Ergebnis</h2>
            <p>Status: {classifyResult.ok ? '✅ erfolgreich' : '⚠ Schema-Fehler'}</p>
            <p>Dauer: {classifyResult.duration_ms} ms</p>
            <p>Kandidaten: {classifyResult.total_candidates} / davon gültig: {classifyResult.valid_topic_ids}</p>
            {classifyResult.schema_error && (
              <p className="text-red-600">Schema-Fehler: {classifyResult.schema_error}</p>
            )}
            <details>
              <summary className="cursor-pointer text-xs text-gray-500">JSON-Antwort anzeigen</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                {JSON.stringify(classifyResult.parsed ?? classifyResult.raw_response, null, 2)}
              </pre>
            </details>
          </section>
        )}
      </div>
    </div>
  )
}
