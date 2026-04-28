'use client'

import { useEffect, useState } from 'react'
import type { TopicWithPath } from '@/lib/types/database.types'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (topic: TopicWithPath) => void
}

export function TopicPicker({ open, onClose, onPick }: Props) {
  const [topics, setTopics] = useState<TopicWithPath[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/topics/tree')
      .then(r => r.json())
      .then(j => setTopics(j.data ?? []))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const filtered = search.trim()
    ? topics.filter(t => t.full_path.toLowerCase().includes(search.toLowerCase()))
    : topics

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
        <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Topic auswählen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="px-4 py-3 border-b border-gray-100">
          <input
            type="text"
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="overflow-auto flex-1">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-400">Lade…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Keine Treffer</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => { onPick(t); onClose() }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    <div className="text-gray-800">{t.name}</div>
                    <div className="text-[11px] text-gray-400">{t.full_path}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
