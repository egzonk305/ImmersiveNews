import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { TopicForm } from '@/components/topics/TopicForm'
import type { Topic } from '@/lib/types/database.types'
import Link from 'next/link'

export default async function NewTopicPage({
  searchParams,
}: {
  searchParams: Promise<{ parent_id?: string }>
}) {
  const { parent_id } = await searchParams
  const supabase = await createClient()

  let parentTopic: Topic | null = null
  if (parent_id) {
    const { data } = await supabase
      .from('topics')
      .select('*')
      .eq('id', parent_id)
      .single<Topic>()
    parentTopic = data
  }

  const { data: possibleParents } = await supabase
    .from('topics')
    .select('id, name, level')
    .lt('level', 5)
    .order('level')
    .order('name')

  return (
    <div>
      <PageHeader
        title="Neues Topic anlegen"
        description={parentTopic ? `Unter: ${parentTopic.name}` : 'Root-Thema oder untergeordnetes Thema'}
        action={
          <Link
            href={parentTopic ? `/topics/${parentTopic.id}` : '/topics'}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Zurück
          </Link>
        }
      />

      <div className="max-w-lg">
        <TopicForm
          parentId={parent_id ?? null}
          parentTopic={parentTopic}
          possibleParents={possibleParents ?? []}
        />
      </div>
    </div>
  )
}
