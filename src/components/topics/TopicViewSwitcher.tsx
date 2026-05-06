'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { TopicTreeBrowser } from './TopicTreeBrowser'
import { TopicTableView } from './TopicTableView'
import type { TopicNode } from '@/lib/types/app.types'

interface TopicViewSwitcherProps {
  roots: TopicNode[]
}

type ViewMode = 'tree' | 'table'

export function TopicViewSwitcher({ roots }: TopicViewSwitcherProps) {
  const [view, setView] = useState<ViewMode>('table')

  return (
    <div>
      {/* View Toggle */}
      <div className="flex items-center gap-1 mb-4 rounded-xl p-0.5 w-fit" style={{ background: 'rgba(255,255,255,0.40)', border: '1px solid rgba(255,255,255,0.60)' }}>
        {([
          { key: 'table' as ViewMode, label: 'Tabelle', icon: '☰' },
          { key: 'tree' as ViewMode, label: 'Baum', icon: '▤' },
        ]).map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              view === item.key
                ? 'bg-white/90 text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {view === 'tree' ? (
        <TopicTreeBrowser roots={roots} />
      ) : (
        <TopicTableView />
      )}
    </div>
  )
}
