'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { levelLabel } from '@/lib/utils'

type ImportFormat = 'csv' | 'json'

interface ParsedRow {
  name: string
  parent_name?: string
  level?: number
}

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [format, setFormat] = useState<ImportFormat>('csv')
  const [parsed, setParsed] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setParsed([])
    setResult(null)

    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()

    try {
      if (format === 'json') {
        const data = JSON.parse(text)
        if (!Array.isArray(data)) throw new Error('JSON muss ein Array sein')
        setParsed(data.map((item: Record<string, unknown>) => ({
          name: String(item.name ?? ''),
          parent_name: item.parent_name ? String(item.parent_name) : undefined,
          level: typeof item.level === 'number' ? item.level : undefined,
        })))
      } else {
        // Einfacher CSV-Parser
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
        if (lines.length < 2) throw new Error('CSV braucht mindestens Header + 1 Zeile')

        const headers = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase().replace(/["']/g, ''))
        const nameIdx = headers.findIndex((h) => h === 'name' || h === 'titel' || h === 'title')
        if (nameIdx === -1) throw new Error('Spalte "name" nicht gefunden')

        const levelIdx = headers.findIndex((h) => h === 'level' || h === 'ebene')
        const parentIdx = headers.findIndex((h) => h.includes('parent') || h.includes('übergeordnet'))

        const rows: ParsedRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ''))
          if (!cols[nameIdx]) continue
          rows.push({
            name: cols[nameIdx],
            level: levelIdx >= 0 ? parseInt(cols[levelIdx]) || undefined : undefined,
            parent_name: parentIdx >= 0 ? cols[parentIdx] || undefined : undefined,
          })
        }
        setParsed(rows)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Parsen')
    }
  }

  const handleImport = async () => {
    if (parsed.length === 0) return
    setImporting(true)
    setError(null)
    setResult(null)

    const errors: string[] = []
    let success = 0

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i]
      try {
        const res = await fetch('/api/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.name,
            parent_id: null,
          }),
        })
        if (res.ok) {
          success++
        } else {
          const json = await res.json()
          errors.push(`Zeile ${i + 1} (${row.name}): ${json.error}`)
        }
      } catch {
        errors.push(`Zeile ${i + 1} (${row.name}): Netzwerkfehler`)
      }
    }

    setResult({ success, errors })
    setImporting(false)
    if (success > 0) router.refresh()
  }

  return (
    <div>
      <PageHeader
        title="Import"
        description="Topics aus CSV oder JSON importieren"
      />

      <div className="max-w-2xl space-y-6">
        {/* Format wählen */}
        <div className="rounded-xl glass-card p-6 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">
            1. Format wählen
          </h2>
          <div className="flex gap-3">
            {(['csv', 'json'] as ImportFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => { setFormat(f); setParsed([]); setResult(null) }}
                className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                  format === f
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200/60 bg-white/60 text-slate-600 hover:bg-white/90 transition-all'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="bg-white/30 rounded-md p-3 text-xs text-gray-500 space-y-1">
            {format === 'csv' ? (
              <>
                <p className="font-medium text-gray-600">CSV-Format (Separator: Komma, Semikolon oder Tab)</p>
                <p>Pflicht-Spalte: <code className="bg-gray-200 px-1 rounded">name</code></p>
                <p>Optional: <code className="bg-gray-200 px-1 rounded">level</code>, <code className="bg-gray-200 px-1 rounded">parent</code></p>
              </>
            ) : (
              <>
                <p className="font-medium text-gray-600">JSON-Format (Array von Objekten)</p>
                <code className="block bg-gray-200 p-2 rounded mt-1">
                  {'[{ "name": "Thema 1" }, { "name": "Thema 2", "level": 2 }]'}
                </code>
              </>
            )}
          </div>
        </div>

        {/* Datei hochladen */}
        <div className="rounded-xl glass-card p-6 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">
            2. Datei auswählen
          </h2>
          <input
            ref={fileRef}
            type="file"
            accept={format === 'csv' ? '.csv,.tsv,.txt' : '.json'}
            onChange={handleFile}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-slate-200/60 file:text-sm file:bg-white/60 file:text-gray-700 hover:file:bg-white/90"
          />
        </div>

        {/* Fehler */}
        {error && (
          <div className="rounded-xl border border-red-200/60 bg-red-50/60 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Vorschau */}
        {parsed.length > 0 && (
          <div className="rounded-xl glass-card p-6 space-y-4">
            <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">
              3. Vorschau ({parsed.length} Einträge)
            </h2>
            <div className="max-h-64 overflow-y-auto rounded border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/30 border-b border-gray-100">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {parsed.slice(0, 50).map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-xs text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-gray-700">{row.name}</td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">
                        {row.level ? levelLabel(row.level) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 50 && (
                <p className="px-3 py-2 text-xs text-gray-400 bg-white/30">
                  … und {parsed.length - 50} weitere
                </p>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-primary rounded-xl px-5 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? `Importiere… (${parsed.length} Einträge)` : `${parsed.length} Einträge importieren`}
            </button>
          </div>
        )}

        {/* Ergebnis */}
        {result && (
          <div className="rounded-xl glass-card p-6 space-y-3">
            <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">
              Import-Ergebnis
            </h2>
            <p className="text-sm text-green-600">
              {result.success} von {parsed.length} Einträgen erfolgreich importiert
            </p>
            {result.errors.length > 0 && (
              <div className="rounded-xl border border-red-200/60 bg-red-50/60 p-3 space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-700">{err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
