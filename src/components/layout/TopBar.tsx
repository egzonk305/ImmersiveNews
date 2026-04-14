'use client'

import { usePathname } from 'next/navigation'

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/topics': 'Topics',
  '/review': 'Review',
  '/import': 'Import',
  '/export': 'Export',
  '/settings/feeds': 'Feed-Einstellungen',
}

export function TopBar() {
  const pathname = usePathname()
  const label = Object.entries(routeLabels).find(([route]) =>
    pathname.startsWith(route)
  )?.[1] ?? ''

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">Admin</span>
      </div>
    </header>
  )
}
