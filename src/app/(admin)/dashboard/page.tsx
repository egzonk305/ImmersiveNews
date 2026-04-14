'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DashStats {
  topicCount: number
  feedCount: number
  pendingReview: number
  levels: { level: number; count: number }[]
}

const levelNames = ['', 'Oberthemen', 'Hauptbereiche', 'Unterbereiche', 'Spez. Themen', 'Einträge']

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [topicsRes, feedsRes, reviewRes] = await Promise.allSettled([
          fetch('/api/topics?pageSize=1').then(r => r.json()),
          fetch('/api/feeds').then(r => r.json()),
          fetch('/api/review/stats').then(r => r.json()),
        ])

        const topicCount = topicsRes.status === 'fulfilled' ? (topicsRes.value.count ?? 0) : 0
        const feedCount = feedsRes.status === 'fulfilled' ? (feedsRes.value.data?.length ?? 0) : 0
        const pendingReview = reviewRes.status === 'fulfilled' ? (reviewRes.value.data?.pending ?? 0) : 0

        setStats({ topicCount, feedCount, pendingReview, levels: [] })
      } catch { /* silent */ }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-medium text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Übersicht der Admin-Plattform</p>
      </div>

      {/* Statistiken */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Topics gesamt', value: stats?.topicCount ?? '–', href: '/topics', color: 'border-blue-200 bg-blue-50/50' },
          { label: 'Aktive Feeds', value: stats?.feedCount ?? '–', href: '/settings/feeds', color: 'border-green-200 bg-green-50/50' },
          { label: 'Review ausstehend', value: stats?.pendingReview ?? '–', href: '/review', color: 'border-amber-200 bg-amber-50/50' },
          { label: 'DB-Tabellen', value: '3', href: '/schema', color: 'border-purple-200 bg-purple-50/50' },
        ].map(s => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-lg border p-4 transition-all hover:shadow-sm ${s.color}`}
          >
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="text-2xl font-medium text-gray-800">
              {loading ? '…' : s.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Schnellzugriff */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-700">Schnellzugriff</h2>
        </div>
        <div className="p-5 grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { href: '/topics/new', label: 'Neues Topic', icon: '＋' },
            { href: '/topics', label: 'Alle Topics', icon: '☰' },
            { href: '/import', label: 'Import', icon: '↑' },
            { href: '/export', label: 'Export', icon: '↓' },
            { href: '/review', label: 'Review-Queue', icon: '✓' },
            { href: '/settings/feeds', label: 'Feeds verwalten', icon: '⟳' },
            { href: '/schema', label: 'DB-Schema', icon: '◈' },
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
  )
}
