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
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings/feeds', label: 'RSS-Feeds', icon: '⟳' },
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
    <aside
      className="w-60 flex flex-col flex-shrink-0 relative"
      style={{
        background: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRight: '1px solid rgba(255,255,255,0.70)',
        boxShadow: '1px 0 24px rgba(99,102,241,0.06)',
      }}
    >
      {/* Logo */}
      <div className="h-14 px-5 flex items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.55)' }}>
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #ec4899 100%)' }}
          >
            IN
          </span>
          <span className="font-semibold text-slate-700 text-sm group-hover:text-violet-600 transition-colors">
            ImmersiveNews
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-violet-400/80">
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
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 relative',
                      isActive
                        ? 'text-violet-700 font-medium shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    )}
                    style={isActive ? {
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(139,92,246,0.10) 60%, rgba(236,72,153,0.07) 100%)',
                      boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.18), 0 1px 3px rgba(99,102,241,0.08)',
                    } : {}}
                    onMouseEnter={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.50)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.background = ''
                      }
                    }}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                        style={{ background: 'linear-gradient(180deg, #6366f1, #ec4899)' }}
                      />
                    )}
                    <span className={cn('w-4 text-center text-base leading-none', isActive ? 'opacity-90' : 'opacity-50')}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && pendingCount > 0 && (
                      <span
                        className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[10px] font-semibold px-1.5 text-white"
                        style={{
                          background: isActive
                            ? 'linear-gradient(135deg, #6366f1, #ec4899)'
                            : 'linear-gradient(135deg, #f59e0b, #f97316)',
                        }}
                      >
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

      {/* Footer */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.55)' }}
      >
        <p className="text-xs text-slate-400">v0.2.0</p>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Online
        </span>
      </div>
    </aside>
  )
}
