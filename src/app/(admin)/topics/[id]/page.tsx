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
        description={`${levelLabel(topic.level)} · Erstellt ${formatDate(topic.created_at)}`}
        action={
          <div className="flex gap-2">
            <Link
              href={`/topics/new?parent_id=${topic.id}`}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              + Unterthema
            </Link>
            <Link
              href={`/topics/${topic.id}/edit`}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Bearbeiten
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <div>
          <p className="mb-1 text-xs text-gray-400">ID</p>
          <p className="truncate font-mono text-xs text-gray-600">{topic.id}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-gray-400">Ebene</p>
          <p className="text-gray-700">{levelLabel(topic.level)}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-gray-400">Unterthemen</p>
          <p className="text-gray-700">{children.length}</p>
        </div>
      </div>

      {children.length > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white">
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
        <div className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center">
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
