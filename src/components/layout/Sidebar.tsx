'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/topics', label: 'Topics', icon: '☰' },
  { href: '/review', label: 'Review', icon: '✓', badge: true },
  { href: '/import', label: 'Import', icon: '↑' },
  { href: '/export', label: 'Export', icon: '↓' },
  { href: '/settings/feeds', label: 'Feeds', icon: '⟳' },
  { href: '/settings/classifier', label: 'KI-Einstellungen', icon: '🧠' },
  { href: '/classification-logs', label: 'KI-Logs', icon: '📋' },
  { href: '/schema', label: 'Schema', icon: '◈' },
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
    // Aktualisiere alle 30 Sekunden
    const interval = setInterval(loadPending, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="h-14 px-5 flex items-center border-b border-gray-100">
        <Link href="/dashboard" className="font-medium text-gray-900 text-sm hover:text-blue-600 transition-colors">
          Admin Platform
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <span className="w-4 text-center opacity-60">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && pendingCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-amber-500 text-white text-[10px] font-medium px-1">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">v0.2.0</p>
      </div>
    </aside>
  )
}
