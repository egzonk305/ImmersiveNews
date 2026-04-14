'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

type ExportFormat = 'csv' | 'json'

export default function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [levelFilter, setLevelFilter] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setError(null)

    try {
      const params = new URLSearchParams({ pageSize: '10000' })
      if (levelFilter) params.set('level', levelFilter)

      const res = await fetch(`/api/topics?${params}`)
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Fehler beim Export')
        return
      }

      const topics = json.data ?? []

      if (topics.length === 0) {
        setError('Keine Daten zum Exportieren')
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
        const headers = ['id', 'name', 'parent_id', 'level', 'created_at']
        const rows = topics.map((t: Record<string, unknown>) =>
          headers.map(h => {
            const val = t[h]
            if (val === null || val === undefined) return ''
            const str = String(val)
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str
          }).join(',')
        )
        content = [headers.join(','), ...rows].join('\n')
        mimeType = 'text/csv'
        extension = 'csv'
      }

      // Download
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `topics-export-${new Date().toISOString().slice(0, 10)}.${extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Export"
        description="Daten aus der Datenbank exportieren"
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="max-w-lg bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
          <div className="flex gap-3">
            {(['csv', 'json'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                  format === f
                    ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ebene filtern</label>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
          >
            <option value="">Alle Ebenen</option>
            <option value="1">Level 1 – Oberthemen</option>
            <option value="2">Level 2 – Hauptbereiche</option>
            <option value="3">Level 3 – Unterbereiche</option>
            <option value="4">Level 4 – Spez. Themen</option>
            <option value="5">Level 5 – Einträge</option>
          </select>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Exportieren…' : `Als ${format.toUpperCase()} exportieren`}
        </button>
      </div>
    </div>
  )
}
