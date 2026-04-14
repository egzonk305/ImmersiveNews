import { createClient } from '@/lib/supabase/server'
import { getRootTopicsWithCount } from '@/lib/services/topic.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { TopicViewSwitcher } from '@/components/topics/TopicViewSwitcher'
import Link from 'next/link'

export default async function TopicsPage() {
  const supabase = await createClient()
  const roots = await getRootTopicsWithCount(supabase)

  // Auch alle Topics für die Tabellen-Ansicht laden
  const { data: allTopics, count } = await supabase
    .from('topics')
    .select('*', { count: 'exact' })
    .order('level')
    .order('name')
    .range(0, 24)

  return (
    <div>
      <PageHeader
        title="Topics"
        description="Themenstruktur der Wissensdatenbank"
        action={
          <Link
            href="/topics/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
          >
            + Neues Topic
          </Link>
        }
      />

      <TopicViewSwitcher
        roots={roots}
        initialTableData={allTopics ?? []}
        initialCount={count ?? 0}
      />
    </div>
  )
}
