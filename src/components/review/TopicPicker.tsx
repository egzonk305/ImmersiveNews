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
      <div className="glass-card rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.60)' }}>
          <h3 className="text-sm font-medium text-slate-700">Topic auswählen</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">✕</button>
        </div>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.60)' }}>
          <input
            type="text"
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="w-full rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300/60"
          />
        </div>
        <div className="overflow-auto flex-1">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-400">Lade…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">Keine Treffer</p>
          ) : (
            <ul className="divide-y divide-white/40">
              {filtered.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => { onPick(t); onClose() }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-white/50 transition-colors"
                  >
                    <div className="text-slate-800">{t.name}</div>
                    <div className="text-[11px] text-slate-400">{t.full_path}</div>
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
