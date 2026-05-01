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
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 min-w-0">
        {crumbs.length === 0 ? (
          <span className="text-gray-400">—</span>
        ) : (
          crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <span key={c.href} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <span className="text-gray-300">/</span>}
                {last ? (
                  <span className="text-gray-800 font-medium truncate">{c.label}</span>
                ) : (
                  <Link href={c.href} className="hover:text-gray-700 transition-colors truncate">
                    {c.label}
                  </Link>
                )}
              </span>
            )
          })
        )}
      </nav>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          DB verbunden
        </span>
        <span className="text-xs font-medium text-gray-600 px-2 py-1 rounded bg-gray-100">
          Admin
        </span>
      </div>
    </header>
  )
}
