'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/topics': 'Topics',
  '/topics/new': 'Neues Topic',
  '/review': 'Review-Queue',
  '/import': 'Import',
  '/export': 'Export',
  '/settings/feeds': 'Feed-Einstellungen',
  '/settings/classifier': 'KI-Einstellungen',
  '/classification-logs': 'KI-Logs',
  '/schema': 'Datenbank-Schema',
}

function buildBreadcrumbs(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; href: string }[] = []
  let acc = ''
  for (const part of parts) {
    acc += `/${part}`
    const label = routeLabels[acc] ?? decodeURIComponent(part).replace(/-/g, ' ')
    crumbs.push({ label, href: acc })
  }
  return crumbs
}

export function TopBar() {
  const pathname = usePathname()
  const crumbs = buildBreadcrumbs(pathname)

  return (
    <header
      className="h-14 px-6 flex items-center justify-between flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.50)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.60)',
        boxShadow: '0 1px 16px rgba(99,102,241,0.05)',
      }}
    >
      <nav className="flex items-center gap-1.5 text-sm min-w-0">
        {crumbs.length === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <span key={c.href} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && (
                  <span className="text-violet-200 font-light select-none">/</span>
                )}
                {last ? (
                  <span className="font-semibold text-slate-700 truncate">{c.label}</span>
                ) : (
                  <Link
                    href={c.href}
                    className="text-slate-400 hover:text-violet-600 transition-colors truncate"
                  >
                    {c.label}
                  </Link>
                )}
              </span>
            )
          })
        )}
      </nav>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          DB verbunden
        </span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full text-violet-700"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.10) 60%, rgba(236,72,153,0.08) 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.20)',
          }}
        >
          Admin
        </span>
      </div>
    </header>
  )
}
