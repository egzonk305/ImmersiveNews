'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { cn, levelLabel } from '@/lib/utils'
import type { TopicNode } from '@/lib/types/app.types'

interface TopicTreeBrowserProps {
  roots: TopicNode[]
}

interface TreeNodeProps {
  node: TopicNode
  depth: number
}

function TreeNode({ node, depth }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0)
  const [children, setChildren] = useState<TopicNode[] | null>(null)
  const [loading, setLoading] = useState(false)

  const hasChildren = !node.isLeaf && (node.childCount ?? 0) > 0

  const handleToggle = useCallback(async () => {
    if (!hasChildren) return

    if (!expanded && children === null) {
      setLoading(true)
      try {
        const res = await fetch(`/api/topics/${node.id}`)
        const json = await res.json()
        setChildren(json.data.children)
      } finally {
        setLoading(false)
      }
    }

    setExpanded((prev) => !prev)
  }, [expanded, children, hasChildren, node.id])

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-gray-50'
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          onClick={handleToggle}
          className={cn(
            'flex h-4 w-4 flex-shrink-0 items-center justify-center text-gray-400',
            !hasChildren && 'invisible'
          )}
          aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
        >
          {loading ? (
            <span className="animate-spin text-xs">⟳</span>
          ) : (
            <span className="text-xs">{expanded ? '▾' : '▸'}</span>
          )}
        </button>

        <span
          className={cn(
            'h-1.5 w-1.5 flex-shrink-0 rounded-full',
            node.level === 1 && 'bg-purple-400',
            node.level === 2 && 'bg-blue-400',
            node.level === 3 && 'bg-teal-400',
            node.level === 4 && 'bg-amber-400',
            node.level === 5 && 'bg-green-400'
          )}
        />

        <Link
          href={`/topics/${node.id}`}
          className="flex-1 truncate text-gray-700 hover:text-blue-600"
        >
          {node.name}
        </Link>

        {hasChildren && (
          <span className="mr-1 text-xs text-gray-400">{node.childCount}</span>
        )}

        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Link
            href={`/topics/new?parent_id=${node.id}`}
            className="px-1 text-xs text-gray-400 hover:text-blue-600"
            title="Untereintrag anlegen"
          >
            +
          </Link>
          <Link
            href={`/topics/${node.id}/edit`}
            className="px-1 text-xs text-gray-400 hover:text-gray-600"
            title="Bearbeiten"
          >
            ✎
          </Link>
        </div>
      </div>

      {expanded && children && children.length > 0 && (
        <ul>
          {children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function TopicTreeBrowser({ roots }: TopicTreeBrowserProps) {
  const [search, setSearch] = useState('')

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
        <input
          type="search"
          placeholder="Topics durchsuchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="hidden items-center gap-3 text-xs text-gray-400 md:flex">
          {[
            { level: 1, color: 'bg-purple-400', label: 'Root' },
            { level: 2, color: 'bg-blue-400', label: 'Bereich' },
            { level: 3, color: 'bg-teal-400', label: 'Unterbereich' },
            { level: 4, color: 'bg-amber-400', label: 'Thema' },
            { level: 5, color: 'bg-green-400', label: 'Eintrag' },
          ].map((l) => (
            <span key={l.level} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', l.color)} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {search ? (
        <SearchResults query={search} />
      ) : (
        <ul className="px-2 py-2">
          {roots.map((root) => (
            <TreeNode key={root.id} node={root} depth={0} />
          ))}
        </ul>
      )}
    </div>
  )
}

function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<TopicNode[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }

    let isCancelled = false
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/topics?search=${encodeURIComponent(query)}`)
        const json = await res.json()
        if (!isCancelled) {
          setResults(json.data ?? [])
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [query])

  if (loading) return <p className="p-4 text-sm text-gray-400">Suche…</p>
  if (!results) return null
  if (results.length === 0) {
    return <p className="p-4 text-sm text-gray-400">Keine Ergebnisse für „{query}“</p>
  }

  return (
    <ul className="px-2 py-2">
      {results.map((r) => (
        <li key={r.id}>
          <Link
            href={`/topics/${r.id}`}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <span className="text-xs text-gray-400">{levelLabel(r.level)}</span>
            {r.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
