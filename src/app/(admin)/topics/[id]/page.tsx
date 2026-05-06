import { createClient } from '@/lib/supabase/server'
import { getTopicDetail } from '@/lib/services/topic.service'
import { levelLabel, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  let detail
  try {
    detail = await getTopicDetail(supabase, id)
  } catch {
    notFound()
  }

  const { topic, children, ancestors } = detail

  const { data: approvedArticles } = await supabase
    .from('incoming_items')
    .select('id, title, description, ai_headline, ai_description, ai_summary_short, source_url, published_at, status')
    .eq('target_topic_id', id)
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1 text-sm text-gray-400">
        <Link href="/topics" className="hover:text-gray-600">Topics</Link>
        {ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1">
            <span>/</span>
            <Link
              href={`/topics/${a.id}`}
              className={a.id === topic.id ? 'font-medium text-gray-700' : 'hover:text-gray-600'}
            >
              {a.name}
            </Link>
          </span>
        ))}
      </nav>

      <PageHeader
        title={topic.name}
        description={`${levelLabel(topic.level)} · Erstellt ${formatDate(topic.created_at)}${topic.is_fixed_root ? ' · Geschütztes Root-Thema' : ''}`}
        icon={topic.is_fixed_root ? '🔒' : '☰'}
        action={
          <>
            <Link
              href={`/topics/new?parent_id=${topic.id}`}
              className="btn-primary inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs"
            >
              ＋ Unterthema
            </Link>
            <Link
              href={`/topics/${topic.id}/edit`}
              className="inline-flex items-center gap-1 rounded-xl glass-card px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors"
            >
              ✎ Bearbeiten
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
        <div className="rounded-xl glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">Ebene</p>
          <p className="text-gray-800 font-medium">{levelLabel(topic.level)}</p>
        </div>
        <div className="rounded-xl glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">Unterthemen</p>
          <p className="text-gray-800 font-medium">{children.length}</p>
        </div>
        <div className="rounded-xl glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">Artikel</p>
          <p className="text-gray-800 font-medium">{approvedArticles?.length ?? 0}</p>
        </div>
        <div className="rounded-xl glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">ID</p>
          <p className="truncate font-mono text-xs text-gray-500" title={topic.id}>{topic.id.slice(0, 8)}…</p>
        </div>
      </div>

      {topic.description && (
        <div className="mb-6 rounded-xl glass-card border-blue-100/60 bg-blue-50/30 p-4 text-sm text-gray-700">
          <p className="mb-1 text-xs uppercase tracking-wide text-blue-700">Themen-Beschreibung</p>
          <p className="whitespace-pre-wrap">{topic.description}</p>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            📰 Artikel in diesem Thema {(approvedArticles?.length ?? 0) > 0 && `(${approvedArticles?.length})`}
          </h2>
          <Link href="/review" className="text-xs text-blue-600 hover:underline">
            Review-Queue →
          </Link>
        </div>
        {(approvedArticles?.length ?? 0) > 0 ? (
          <ul className="divide-y divide-gray-100">
            {(approvedArticles ?? []).map((a) => (
              <li key={a.id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{a.ai_headline ?? a.title}</p>
                    {a.ai_summary_short ? (
                      <p className="mt-1 text-xs text-gray-600 line-clamp-2">{a.ai_summary_short}</p>
                    ) : a.description ? (
                      <p className="mt-1 text-xs text-gray-600 line-clamp-2">{a.description}</p>
                    ) : null}
                    {a.published_at && (
                      <p className="mt-1 text-[11px] text-gray-400">{formatDate(a.published_at)}</p>
                    )}
                  </div>
                  {a.source_url && (
                    <a href={a.source_url} target="_blank" rel="noreferrer" className="shrink-0 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-white hover:text-blue-600">
                      Quelle ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-400 mb-2">Noch keine Artikel klassifiziert</p>
            <p className="text-xs text-gray-400">
              Artikel erscheinen hier nach dem Klassifizieren in der{' '}
              <Link href="/review" className="text-blue-600 hover:underline">Review-Queue</Link>.
            </p>
          </div>
        )}
      </div>

      {children.length > 0 ? (
        <div className="rounded-xl glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-medium text-gray-700">
              Untergeordnete Einträge ({children.length})
            </h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {children.map((child) => (
              <li key={child.id} className="group flex items-center justify-between px-5 py-3">
                <Link
                  href={`/topics/${child.id}`}
                  className="flex items-center gap-2 text-sm text-gray-800 hover:text-blue-600"
                >
                  {child.isLeaf ? (
                    <span className="text-xs text-blue-400">●</span>
                  ) : (
                    <span className="text-xs text-gray-300">▸</span>
                  )}
                  {child.name}
                  {child.childCount !== undefined && child.childCount > 0 && (
                    <span className="text-xs text-gray-400">({child.childCount})</span>
                  )}
                </Link>
                <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    href={`/topics/${child.id}/edit`}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Bearbeiten
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl glass-card p-10 text-center">
          <p className="mb-3 text-sm text-gray-400">Noch keine Untereinträge vorhanden</p>
          <Link
            href={`/topics/new?parent_id=${topic.id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            Ersten Untereintrag anlegen →
          </Link>
        </div>
      )}
    </div>
  )
}
