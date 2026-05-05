'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { cn, levelLabel } from '@/lib/utils'
import type { TopicNode } from '@/lib/types/app.types'

type TreeNode = TopicNode

interface TopicTreeBrowserProps {
  roots: TreeNode[]
}

function updateNodeInTree(
  nodes: TreeNode[],
  id: string,
  updater: (node: TreeNode) => TreeNode
): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node)
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, id, updater) }
    }
    return node
  })
}

function removeNodeFromTree(nodes: TreeNode[], id: string): TreeNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({
      ...node,
      children: node.children ? removeNodeFromTree(node.children, id) : node.children,
    }))
}

function collectExpandableIds(nodes: TreeNode[]) {
  const ids: string[] = []
  const walk = (items: TreeNode[]) => {
    for (const item of items) {
      if ((item.childCount ?? item.children?.length ?? 0) > 0 && item.level < 5) {
        ids.push(item.id)
      }
      if (item.children) walk(item.children)
    }
  }
  walk(nodes)
  return ids
}

function SkeletonRow({ depth }: { depth: number }) {
  return (
    <div
      className="flex items-center gap-2 py-1.5 px-2"
      style={{ paddingLeft: `${depth * 20 + 8}px` }}
    >
      <span className="h-4 w-4 rounded bg-gray-100 animate-pulse" />
      <span className="h-3 w-40 rounded bg-gray-100 animate-pulse" />
    </div>
  )
}

export function TopicTreeBrowser({ roots }: TopicTreeBrowserProps) {
  const [treeData, setTreeData] = useState<TreeNode[]>(roots)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null)
  const [newChildName, setNewChildName] = useState('')
  const [savingChild, setSavingChild] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expandableIds = useMemo(() => collectExpandableIds(treeData), [treeData])

  const expandAll = () => setExpanded(new Set(expandableIds))
  const collapseAll = () => setExpanded(new Set())

  const toggleExpand = useCallback(async (id: string) => {
    if (expanded.has(id)) {
      setExpanded(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      return
    }

    const findNode = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node
        if (node.children) {
          const found = findNode(node.children)
          if (found) return found
        }
      }
      return null
    }

    const node = findNode(treeData)
    if (!node?.children) {
      setLoadingId(id)
      try {
        const res = await fetch(`/api/topics/${id}`)
        const json = await res.json()
        if (res.ok && json.data?.children) {
          setTreeData(prev => updateNodeInTree(prev, id, item => ({
            ...item,
            children: json.data.children,
            childCount: json.data.children.length,
            isLeaf: json.data.children.length === 0,
          })))
        } else {
          setError(json.error ?? 'Unterthemen konnten nicht geladen werden')
        }
      } catch {
        setError('Netzwerkfehler beim Laden der Unterthemen')
      } finally {
        setLoadingId(null)
      }
    }

    setExpanded(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [expanded, treeData])

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      const json = await res.json()
      if (res.ok) {
        setTreeData(prev => updateNodeInTree(prev, id, node => ({ ...node, name: renameValue.trim() })))
        setRenamingId(null)
      } else {
        setError(json.error ?? 'Fehler beim Umbenennen')
      }
    } catch {
      setError('Netzwerkfehler beim Umbenennen')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Topic wirklich löschen?')) return
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      })

      if (res.status === 409) {
        if (!confirm('Topic hat Unterthemen. Trotzdem mit allen Unterthemen löschen?')) return
        const forced = await fetch(`/api/topics/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        })
        if (!forced.ok) {
          const json = await forced.json()
          setError(json.error ?? 'Topic konnte nicht gelöscht werden')
          return
        }
      } else if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Topic konnte nicht gelöscht werden')
        return
      }

      setTreeData(prev => removeNodeFromTree(prev, id))
    } catch {
      setError('Netzwerkfehler beim Löschen')
    }
  }

  const handleAddChild = async (parentId: string) => {
    setAddingChildOf(parentId)
    setNewChildName('')
    if (!expanded.has(parentId)) {
      setExpanded(prev => {
        const next = new Set(prev)
        next.add(parentId)
        return next
      })
    }
  }

  const saveNewChild = async (parentId: string) => {
    if (!newChildName.trim()) {
      setAddingChildOf(null)
      return
    }

    setSavingChild(true)
    setError(null)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newChildName.trim(), parent_id: parentId }),
      })
      const json = await res.json()
      if (res.ok) {
        const newNode: TreeNode = { ...json.data, children: [], childCount: 0, isLeaf: true }
        setTreeData(prev => updateNodeInTree(prev, parentId, node => ({
          ...node,
          children: [...(node.children ?? []), newNode],
          childCount: (node.childCount ?? node.children?.length ?? 0) + 1,
          isLeaf: false,
        })))
        setAddingChildOf(null)
      } else {
        setError(json.error ?? 'Fehler beim Anlegen')
      }
    } catch {
      setError('Netzwerkfehler beim Anlegen')
    } finally {
      setSavingChild(false)
    }
  }

  const renderNode = (node: TreeNode, depth = 0): React.ReactNode => {
    const isExpanded = expanded.has(node.id)
    const isRenaming = renamingId === node.id
    const canExpand = node.level < 5 && !node.isLeaf

    return (
      <div key={node.id}>
        <div className="relative">
          {depth > 0 && (
            <span
              className="absolute top-1/2 border-t border-gray-200 pointer-events-none"
              style={{ left: `${(depth - 1) * 20 + 16}px`, width: '12px' }}
            />
          )}

          <div
            className={cn(
              'group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-gray-50',
              isRenaming && 'bg-blue-50'
            )}
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
          >
            <button
              onClick={() => canExpand && toggleExpand(node.id)}
              disabled={!canExpand}
              className={cn(
                'z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px]',
                canExpand ? 'text-gray-500 hover:bg-gray-200 hover:text-gray-700' : 'text-gray-300'
              )}
              title={canExpand ? (isExpanded ? 'Einklappen' : 'Aufklappen') : 'Keine Unterthemen'}
            >
              {loadingId === node.id ? '⟳' : canExpand ? (isExpanded ? '▼' : '▶') : '·'}
            </button>

            {isRenaming ? (
              <>
                <input
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename(node.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  autoFocus
                  className="min-w-0 flex-1 rounded border border-blue-300 px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => handleRename(node.id)} className="text-[11px] font-medium text-blue-600">OK</button>
                <button onClick={() => setRenamingId(null)} className="text-[11px] text-gray-400">Abb.</button>
              </>
            ) : (
              <>
                <Link
                  href={`/topics/${node.id}`}
                  className="min-w-0 flex-1 truncate text-gray-700 transition-colors hover:text-blue-600"
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    setRenamingId(node.id)
                    setRenameValue(node.name)
                  }}
                  title={`${node.name} (Doppelklick = Umbenennen)`}
                >
                  {node.name}
                </Link>
                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                  {levelLabel(node.level)}
                </span>
                {(node.childCount ?? 0) > 0 && (
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {node.childCount}
                  </span>
                )}
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => { setRenamingId(node.id); setRenameValue(node.name) }}
                    className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 transition-colors hover:bg-gray-200"
                    title="Umbenennen"
                  >
                    ✎
                  </button>
                  {node.level < 5 && (
                    <button
                      onClick={() => handleAddChild(node.id)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 transition-colors hover:bg-gray-200"
                      title="Unterthema anlegen"
                    >
                      ＋
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(node.id)}
                    className="rounded px-1.5 py-0.5 text-[10px] text-red-400 transition-colors hover:bg-red-50"
                    title="Löschen"
                  >
                    ×
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="relative">
            <span
              className="absolute bottom-0 top-0 border-l border-gray-200 pointer-events-none"
              style={{ left: `${depth * 20 + 16}px` }}
            />
            {loadingId === node.id ? (
              <>
                <SkeletonRow depth={depth + 1} />
                <SkeletonRow depth={depth + 1} />
              </>
            ) : node.children && node.children.length > 0 ? (
              node.children.map(child => renderNode(child, depth + 1))
            ) : node.children && node.children.length === 0 ? (
              <div
                className="py-1 text-xs text-gray-400"
                style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
              >
                Keine Unterthemen
              </div>
            ) : null}

            {addingChildOf === node.id && (
              <div
                className="flex items-center gap-2 px-2 py-1.5"
                style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
              >
                <input
                  type="text"
                  value={newChildName}
                  onChange={e => setNewChildName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveNewChild(node.id)
                    if (e.key === 'Escape') setAddingChildOf(null)
                  }}
                  placeholder="Neues Unterthema..."
                  autoFocus
                  disabled={savingChild}
                  className="min-w-0 flex-1 rounded border border-blue-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => saveNewChild(node.id)}
                  disabled={savingChild}
                  className="text-[11px] font-medium text-blue-600 disabled:opacity-50"
                >
                  {savingChild ? '...' : 'OK'}
                </button>
                <button onClick={() => setAddingChildOf(null)} className="text-[11px] text-gray-400">Abb.</button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-2 flex items-center justify-between rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400">×</button>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={expandAll}
          className="rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Alle aufklappen
        </button>
        <button
          onClick={collapseAll}
          className="rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Alle einklappen
        </button>
      </div>

      {treeData.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          Noch keine Topics vorhanden.{' '}
          <Link href="/topics/new" className="text-blue-600 hover:underline">
            Erstelle das erste Topic
          </Link>
        </div>
      ) : (
        <div className="space-y-0">
          {treeData.map(root => renderNode(root))}
        </div>
      )}
    </div>
  )
}
