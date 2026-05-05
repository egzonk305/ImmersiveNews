import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'
import type { Topic } from '@/lib/types/database.types'

type TopicTreeNode = Topic & {
  children?: TopicTreeNode[]
  childCount?: number
  isLeaf?: boolean
}

// GET /api/topics/tree
// Ohne depth: flache Liste mit full_path fuer TopicPicker und Klassifizierer.
// Mit depth=1..5: verschachtelte aktive Topic-Struktur bis zur gewuenschten Tiefe.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const depthParam = searchParams.get('depth')

    if (depthParam !== null) {
      const depth = Math.min(Math.max(Number(depthParam) || 1, 1), 5)
      const { data: topics, error } = await supabase
        .from('topics')
        .select('*')
        .eq('topic_status', 'active')
        .lte('level', depth)
        .order('level')
        .order('name')

      if (error) throw new Error(error.message)

      const nodes = new Map<string, TopicTreeNode>()
      for (const topic of topics ?? []) {
        nodes.set(topic.id, {
          ...topic,
          children: [],
          childCount: 0,
          isLeaf: topic.level >= 5,
        })
      }

      const roots: TopicTreeNode[] = []
      for (const node of nodes.values()) {
        if (node.parent_id && nodes.has(node.parent_id)) {
          nodes.get(node.parent_id)!.children!.push(node)
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
          if (row.parent_id) {
            countMap.set(row.parent_id, (countMap.get(row.parent_id) ?? 0) + 1)
          }
        }

        for (const node of nodes.values()) {
          const childCount = countMap.get(node.id) ?? 0
          node.childCount = childCount
          node.isLeaf = node.level >= 5 || childCount === 0
        }
      }

      return NextResponse.json({ data: roots })
    }

    const { data, error } = await supabase
      .from('topics_with_path')
      .select('*')
      .order('full_path')

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
