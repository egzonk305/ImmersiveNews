'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { cn, levelLabel } from '@/lib/utils'
import type { Topic } from '@/lib/types/database.types'

interface TreeNode extends Topic {
  children?: TreeNode[]
  childCount?: number
}

interface TopicTreeBrowserProps {
  roots: TreeNode[]
}

export function TopicTreeBrowser({ roots }: TopicTreeBrowserProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [children, setChildren] = useState<Map<string, TreeNode[]>>(new Map())
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const toggleExpand = useCallback(async (id: string) => {
    if (expanded.has(id)) {
      setExpanded(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      return
    }

    // Lade Kinder wenn nötig
    if (!children.has(id)) {
      setLoadingId(id)
      try {
        const res = await fetch(`/api/topics/${id}`)
        const json = await res.json()
        if (res.ok && json.data?.children) {
          setChildren(prev => new Map(prev).set(id, json.data.children))
        }
      } catch { /* silent */ }
      setLoadingId(null)
    }

    setExpanded(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [expanded, children])

  const handleRename = async (id: string) => {
    if (!editName.trim()) return
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (res.ok) {
        setEditingId(null)
        // Aktualisiere lokalen State
        // (simpel: Seite neu laden für vollständige Aktualisierung)
        window.location.reload()
      } else {
        const json = await res.json()
        setError(json.error ?? 'Fehler')
      }
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Topic wirklich löschen?')) return
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      })

      if (res.status === 409) {
        if (confirm('Topic hat Unterthemen. Trotzdem mit allen Unterthemen löschen?')) {
          const res2 = await fetch(`/api/topics/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true }),
          })
          if (res2.ok) window.location.reload()
        }
        return
      }

      if (res.ok) window.location.reload()
    } catch {
      setError('Netzwerkfehler')
    }
  }

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expanded.has(node.id)
    const isLoading = loadingId === node.id
    const nodeChildren = children.get(node.id)
    const isLeaf = node.level >= 5
    const isEditing = editingId === node.id

    return (
      <div key={node.id}>
        <div
          className={cn(
            'group flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-gray-50 transition-colors text-sm',
            isEditing && 'bg-blue-50'
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {/* Expand/Collapse */}
          {!isLeaf ? (
            <button
              onClick={() => toggleExpand(node.id)}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              {isLoading ? (
                <span className="animate-spin text-[10px]">⟳</span>
              ) : (
                <span className="text-[10px]">{isExpanded ? '▼' : '▶'}</span>
              )}
            </button>
          ) : (
            <span className="w-4 h-4 flex items-center justify-center text-gray-300 flex-shrink-0 text-[10px]">
              ·
            </span>
          )}

          {/* Name */}
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(node.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
                className="flex-1 rounded border border-blue-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => handleRename(node.id)} className="text-[10px] text-blue-600 font-medium">OK</button>
              <button onClick={() => setEditingId(null)} className="text-[10px] text-gray-400">Abb.</button>
            </div>
          ) : (
            <>
              <Link
                href={`/topics/${node.id}`}
                className="flex-1 truncate text-gray-700 hover:text-blue-600 transition-colors"
                onDoubleClick={(e) => {
                  e.preventDefault()
                  setEditingId(node.id)
                  setEditName(node.name)
                }}
                title={`${node.name} (Doppelklick = Umbenennen)`}
              >
                {node.name}
              </Link>

              <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
                {levelLabel(node.level)}
              </span>

              {/* Aktions-Buttons */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => { setEditingId(node.id); setEditName(node.name) }}
                  className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-200 transition-colors"
                  title="Umbenennen"
                >
                  ✎
                </button>
                {!isLeaf && (
                  <Link
                    href={`/topics/new?parent_id=${node.id}`}
                    className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-200 transition-colors"
                    title="Unterthema anlegen"
                  >
                    ＋
                  </Link>
                )}
                <button
                  onClick={() => handleDelete(node.id)}
                  className="rounded px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-50 transition-colors"
                  title="Löschen"
                >
                  ✕
                </button>
              </div>
            </>
          )}
        </div>

        {/* Kinder */}
        {isExpanded && nodeChildren && nodeChildren.length > 0 && (
          <div>
            {nodeChildren.map(child => renderNode(child, depth + 1))}
          </div>
        )}

        {isExpanded && nodeChildren && nodeChildren.length === 0 && (
          <div
            className="text-xs text-gray-400 py-1"
            style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
          >
            Keine Unterthemen
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">✕</button>
        </div>
      )}

      {roots.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          Noch keine Topics vorhanden.{' '}
          <Link href="/topics/new" className="text-blue-600 hover:underline">
            Erstelle das erste Topic
          </Link>
        </div>
      ) : (
        <div className="space-y-0.5">
          {roots.map(root => renderNode(root))}
        </div>
      )}
    </div>
  )
}
