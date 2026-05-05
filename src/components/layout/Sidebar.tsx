'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: string
  badge?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Übersicht',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
    ],
  },
  {
    label: 'Inhalte',
    items: [
      { href: '/topics', label: 'Topics', icon: '☰' },
      { href: '/review', label: 'Review', icon: '✓', badge: true },
      { href: '/import', label: 'Import', icon: '↑' },
      { href: '/export', label: 'Export', icon: '↓' },
    ],
  },
  {
    label: 'KI',
    items: [
      { href: '/settings/classifier', label: 'Klassifizierer', icon: '🧠' },
      { href: '/classification-logs', label: 'KI-Logs', icon: '📋' },
      { href: '/topic-suggestions', label: 'Topic-Vorschläge', icon: '💡' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings/feeds', label: 'RSS-Feeds', icon: '⟳' },
      { href: '/lifecycle', label: 'Lifecycle', icon: '♻' },
      { href: '/cleanup', label: 'Aufräumen', icon: '🗑' },
      { href: '/schema', label: 'Schema', icon: '◈' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const loadPending = async () => {
      try {
        const res = await fetch('/api/review/stats')
        const json = await res.json()
        if (res.ok) setPendingCount(json.data?.pending ?? 0)
      } catch { /* silent */ }
    }
    loadPending()
    const interval = setInterval(loadPending, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="h-14 px-5 flex items-center border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <span className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            IN
          </span>
          <span className="font-medium text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
            ImmersiveNews
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && 'mt-5')}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative',
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 rounded-r" />
                    )}
                    <span className="w-4 text-center opacity-70">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && pendingCount > 0 && (
                      <span className={cn(
                        'inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full text-[10px] font-medium px-1.5',
                        isActive ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
                      )}>
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-400">v0.2.0</p>
        <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Online
        </span>
      </div>
    </aside>
  )
}
