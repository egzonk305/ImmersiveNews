'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

type SchemaData = Record<string, Array<{
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}>> | Record<string, string[]>

export default function SchemaPage() {
  const [schema, setSchema] = useState<SchemaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/schema')
        const json = await res.json()
        if (res.ok) {
          setSchema(json.data)
          setIsFallback(!!json.fallback)
        } else {
          setError(json.error)
        }
      } catch {
        setError('Schema konnte nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const tableNames = schema ? Object.keys(schema).sort() : []

  const dataTypeColor = (type: string) => {
    if (type.includes('uuid')) return 'text-purple-600 bg-purple-50'
    if (type.includes('text') || type.includes('character')) return 'text-green-600 bg-green-50'
    if (type.includes('int') || type.includes('numeric')) return 'text-blue-600 bg-blue-50'
    if (type.includes('bool')) return 'text-amber-600 bg-amber-50'
    if (type.includes('timestamp') || type.includes('date')) return 'text-orange-600 bg-orange-50'
    if (type.includes('json')) return 'text-pink-600 bg-pink-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <div>
      <PageHeader
        title="Datenbank-Schema"
        description="Aktuelle Tabellenstruktur – aktualisiert sich automatisch bei Änderungen"
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200/60 bg-red-50/60 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isFallback && (
        <div className="mb-4 rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-xs text-amber-700">
          Schema-Introspection-Funktion nicht verfügbar. Zeige Fallback-Informationen.
          Führe die SQL-Migration <code className="bg-amber-100 px-1 rounded">get_schema_info()</code> aus für vollständige Spaltendetails.
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-gray-400 py-12">Laden…</div>
      ) : (
        <div className="grid gap-4 max-w-3xl">
          {tableNames.map(tableName => {
            const columns = schema![tableName]
            const isExpanded = expandedTable === tableName
            const isDetailed = Array.isArray(columns) && columns.length > 0 && typeof columns[0] === 'object' && 'data_type' in columns[0]

            return (
              <div key={tableName} className="rounded-xl glass-card overflow-hidden">
                <button
                  onClick={() => setExpandedTable(isExpanded ? null : tableName)}
                  className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-mono">{isExpanded ? '▼' : '▶'}</span>
                    <span className="font-mono text-sm font-medium text-gray-800">{tableName}</span>
                    <span className="text-xs text-gray-400">
                      {Array.isArray(columns) ? columns.length : 0} Spalten
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {tableName === 'topics' ? '📂 Haupttabelle' :
                     tableName === 'rss_feeds' ? '⟳ Feeds' :
                     tableName === 'incoming_items' ? '📥 Review-Queue' :
                     ''}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {isDetailed ? (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 text-left text-gray-400">
                            <th className="px-5 py-2">Spalte</th>
                            <th className="px-3 py-2">Typ</th>
                            <th className="px-3 py-2">Nullable</th>
                            <th className="px-3 py-2">Default</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(columns as Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>).map(col => (
                            <tr key={col.column_name} className="hover:bg-white/30">
                              <td className="px-5 py-2 font-mono text-gray-700">{col.column_name}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-mono ${dataTypeColor(col.data_type)}`}>
                                  {col.data_type}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-400">
                                {col.is_nullable === 'YES' ? 'ja' : 'nein'}
                              </td>
                              <td className="px-3 py-2 font-mono text-gray-400 truncate max-w-[200px]">
                                {col.column_default || '–'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="px-5 py-3 flex flex-wrap gap-2">
                        {(columns as string[]).map(col => (
                          <span key={col} className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600">
                            {col}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {tableNames.length === 0 && !loading && (
            <div className="text-center text-sm text-gray-400 py-12">
              Keine Tabellen gefunden. Stelle sicher, dass die Datenbankverbindung konfiguriert ist.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
