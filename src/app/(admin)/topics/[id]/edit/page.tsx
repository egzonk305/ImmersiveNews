import { createClient } from '@/lib/supabase/server'
import { getTopicDetail } from '@/lib/services/topic.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { TopicEditForm } from '@/components/topics/TopicEditForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function EditTopicPage({
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

  const { topic, ancestors } = detail

  const { data: possibleParents } = await supabase
    .from('topics')
    .select('id, name, level')
    .neq('id', id)
    .lt('level', 5)
    .order('level')
    .order('name')

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1 text-sm text-gray-400">
        <Link href="/topics" className="hover:text-gray-600">Topics</Link>
        {ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1">
            <span>/</span>
            <Link href={`/topics/${a.id}`} className="hover:text-gray-600">
              {a.name}
            </Link>
          </span>
        ))}
      </nav>

      <PageHeader
        title={`„${topic.name}" bearbeiten`}
        description={`ID: ${topic.id}`}
        action={
          <Link
            href={`/topics/${topic.id}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Zurück zur Detailansicht
          </Link>
        }
      />

      <div className="max-w-lg">
        <TopicEditForm
          topic={topic}
          possibleParents={possibleParents ?? []}
        />
      </div>
    </div>
  )
}
