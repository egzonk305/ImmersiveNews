'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { levelLabel } from '@/lib/utils'

type ExportFormat = 'csv' | 'json'

export default function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [levelFilter, setLevelFilter] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (levelFilter) params.set('level', String(levelFilter))
      params.set('pageSize', '10000')

      const res = await fetch(`/api/topics?${params}`)
      const json = await res.json()

      if (!res.ok) throw new Error(json.error ?? 'Fehler beim Laden')

      const topics = json.data ?? []

      if (topics.length === 0) {
        setError('Keine Daten zum Exportieren gefunden')
        setExporting(false)
        return
      }

      let content: string
      let mimeType: string
      let extension: string

      if (format === 'json') {
        content = JSON.stringify(topics, null, 2)
        mimeType = 'application/json'
        extension = 'json'
      } else {
        const headers = ['id', 'name', 'level', 'parent_id', 'created_at']
        const rows = topics.map((t: Record<string, unknown>) =>
          headers.map((h) => {
            const val = t[h]
            if (val === null || val === undefined) return ''
            const str = String(val)
            return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
          }).join(',')
        )
        content = [headers.join(','), ...rows].join('\n')
        mimeType = 'text/csv'
        extension = 'csv'
      }

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `topics-export-${new Date().toISOString().slice(0, 10)}.${extension}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export fehlgeschlagen')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Export"
        description="Topics als CSV oder JSON herunterladen"
      />

      <div className="max-w-lg space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
            <div className="flex gap-3">
              {(['csv', 'json'] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                    format === f
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Level-Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ebene filtern</label>
            <select
              value={levelFilter ?? ''}
              onChange={(e) => setLevelFilter(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Alle Ebenen</option>
              {[1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>{levelLabel(l)}</option>
              ))}
            </select>
          </div>

          {/* Info */}
          <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-500">
            <p>Der Export enthält folgende Felder: <code>id</code>, <code>name</code>, <code>level</code>, <code>parent_id</code>, <code>created_at</code></p>
          </div>

          {/* Fehler */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full px-5 py-2.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? 'Exportiere…' : `Als ${format.toUpperCase()} herunterladen`}
          </button>
        </div>
      </div>
    </div>
  )
}
