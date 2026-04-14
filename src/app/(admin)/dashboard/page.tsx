import { createClient } from '@/lib/supabase/server'
import { getTreeStats } from '@/lib/services/topic.service'
import { levelLabel, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const stats = await getTreeStats(supabase)

  // Letzte 5 neu angelegten Topics
  const { data: recent } = await supabase
    .from('topics')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Übersicht der Wissensdatenbank"
      />

      {/* Stats-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.levels.map((l) => (
          <div
            key={l.level}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <p className="text-xs text-gray-500 mb-1">{levelLabel(l.level)}</p>
            <p className="text-2xl font-medium text-gray-900">{l.count}</p>
          </div>
        ))}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Gesamt</p>
          <p className="text-2xl font-medium text-gray-900">{stats.total}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Zuletzt hinzugefügt */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">Zuletzt hinzugefügt</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {recent?.map((topic) => (
              <li key={topic.id} className="px-5 py-3 flex justify-between items-center">
                <div>
                  <Link
                    href={`/topics/${topic.id}`}
                    className="text-sm text-gray-900 hover:text-blue-600"
                  >
                    {topic.name}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">{levelLabel(topic.level)}</p>
                </div>
                <span className="text-xs text-gray-400">{formatDate(topic.created_at)}</span>
              </li>
            ))}
          </ul>
          <div className="px-5 py-3 border-t border-gray-100">
            <Link href="/topics" className="text-xs text-blue-600 hover:underline">
              Alle Topics anzeigen →
            </Link>
          </div>
        </div>

        {/* Schnellzugriff */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">Schnellzugriff</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {[
              { href: '/topics/new', label: 'Neues Topic', icon: '＋' },
              { href: '/topics?level=5', label: 'Alle Einträge', icon: '☰' },
              { href: '/import', label: 'Import', icon: '↑' },
              { href: '/export', label: 'Export', icon: '↓' },
              { href: '/review', label: 'Review-Queue', icon: '✓' },
              { href: '/topics?duplicates=true', label: 'Duplikate', icon: '⚠' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <span className="text-gray-400 w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
