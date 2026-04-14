'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { TopicTreeBrowser } from './TopicTreeBrowser'
import { TopicTableView } from './TopicTableView'
import type { TopicNode } from '@/lib/types/app.types'
import type { Topic } from '@/lib/types/database.types'

interface TopicViewSwitcherProps {
  roots: TopicNode[]
  initialTableData: Topic[]
  initialCount: number
}

type ViewMode = 'tree' | 'table'

export function TopicViewSwitcher({ roots, initialTableData, initialCount }: TopicViewSwitcherProps) {
  const [view, setView] = useState<ViewMode>('table')

  return (
    <div>
      {/* View Toggle */}
      <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-0.5 w-fit">
        {([
          { key: 'table' as ViewMode, label: 'Tabelle', icon: '☰' },
          { key: 'tree' as ViewMode, label: 'Baum', icon: '▤' },
        ]).map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              view === item.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
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
        <TopicTableView initialData={initialTableData} initialCount={initialCount} />
      )}
    </div>
  )
}
