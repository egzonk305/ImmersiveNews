import { createClient } from '@/lib/supabase/server'
import { getRootTopicsWithCount } from '@/lib/services/topic.service'
import { PageHeader } from '@/components/layout/PageHeader'
import { TopicViewSwitcher } from '@/components/topics/TopicViewSwitcher'
import Link from 'next/link'

export default async function TopicsPage() {
  const supabase = await createClient()
  const roots = await getRootTopicsWithCount(supabase)

  return (
    <div>
      <PageHeader
        title="Topics"
        description="Themenstruktur der Wissensdatenbank"
        icon="☰"
        action={
          <Link
            href="/topics/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 shadow-sm"
          >
            <span>＋</span> Neues Topic
          </Link>
        }
      />

      <TopicViewSwitcher roots={roots} />
    </div>
  )
}
