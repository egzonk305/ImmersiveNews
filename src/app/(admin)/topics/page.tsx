import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { TopicViewSwitcher } from '@/components/topics/TopicViewSwitcher'
import Link from 'next/link'
import type { TopicNode } from '@/lib/types/app.types'

async function getTopicTreeDepth2(): Promise<TopicNode[]> {
  const supabase = await createClient()
  const { data: topics, error } = await supabase
    .from('topics')
    .select('*')
    .eq('topic_status', 'active')
    .lte('level', 2)
    .order('level')
    .order('name')

  if (error) throw new Error(error.message)

  const nodes = new Map<string, TopicNode>()
  for (const topic of topics ?? []) {
    // children: undefined = not yet loaded; only set to [] when we actually append children below
    nodes.set(topic.id, { ...topic, children: undefined, childCount: 0, isLeaf: topic.level >= 8 })
  }

  const roots: TopicNode[] = []
  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) {
      const parent = nodes.get(node.parent_id)!
      if (!parent.children) parent.children = []
      parent.children.push(node)
    } else if (node.parent_id === null) {
      roots.push(node)
    }
  }

  if (nodes.size > 0) {
    const { data: childRows, error: childError } = await supabase
      .from('topics')
      .select('parent_id')
      .eq('topic_status', 'active')
      .in('parent_id', Array.from(nodes.keys()))

    if (childError) throw new Error(childError.message)

    const countMap = new Map<string, number>()
    for (const row of childRows ?? []) {
      if (row.parent_id) countMap.set(row.parent_id, (countMap.get(row.parent_id) ?? 0) + 1)
    }

    for (const node of nodes.values()) {
      const childCount = countMap.get(node.id) ?? 0
      node.childCount = childCount
      node.isLeaf = node.level >= 8 || childCount === 0
    }
  }

  return roots
}

export default async function TopicsPage() {
  const roots = await getTopicTreeDepth2()

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
