import * as db from '@/lib/adapters/supabase.adapter'
import type { TopicNode } from '@/lib/types/app.types'
import type { Topic } from '@/lib/types/database.types'

type Supabase = Parameters<typeof db.getRootTopics>[0]

// ─── Lesende Operationen ──────────────────────────────────────────────────────

/** Root-Topics mit Kinderzahl anreichern */
export async function getRootTopicsWithCount(supabase: Supabase) {
  const roots = await db.getRootTopics(supabase)

  const enriched = await Promise.all(
    roots.map(async (topic) => {
      const childCount = await db.getChildCount(supabase, topic.id)
      return { ...topic, childCount, isLeaf: childCount === 0 } as TopicNode
    })
  )

  return enriched
}

/** Topic mit Kindern und Breadcrumb */
export async function getTopicDetail(supabase: Supabase, id: string) {
  const [topic, children, ancestors] = await Promise.all([
    db.getTopicById(supabase, id),
    db.getChildren(supabase, id),
    db.getTopicAncestors(supabase, id),
  ])

  const childrenWithCount = await Promise.all(
    children.map(async (child) => {
      const childCount = await db.getChildCount(supabase, child.id)
      return { ...child, childCount, isLeaf: childCount === 0 } as TopicNode
    })
  )

  return { topic, children: childrenWithCount, ancestors }
}

/** Blatt-Knoten (Level 5 oder ohne Kinder) – das sind die eigentlichen Inhalte */
export async function getLeafTopics(supabase: Supabase, options?: {
  parentId?: string
  search?: string
  page?: number
  pageSize?: number
}) {
  const { page = 1, pageSize = 50, search, parentId } = options ?? {}

  if (search) {
    const results = await db.searchTopics(supabase, search, 5)
    return { data: results, count: results.length }
  }

  if (parentId) {
    const subtree = await db.getTopicSubtree(supabase, parentId)
    const leaves = subtree.filter((t) => t.level === 5)
    const start = (page - 1) * pageSize
    return {
      data: leaves.slice(start, start + pageSize),
      count: leaves.length,
    }
  }

  const all = await db.getTopicsByLevel(supabase, 5)
  const start = (page - 1) * pageSize
  return {
    data: all.slice(start, start + pageSize),
    count: all.length,
  }
}

// ─── Schreibende Operationen ──────────────────────────────────────────────────

/** Neues Topic anlegen – Level wird automatisch vom Parent abgeleitet */
export async function createTopic(
  supabase: Supabase,
  input: { name: string; parent_id: string | null }
) {
  let level = 1

  if (input.parent_id) {
    const parent = await db.getTopicById(supabase, input.parent_id)
    level = parent.level + 1

    if (level > 5) {
      throw new Error('Maximale Tiefe (5 Ebenen) erreicht')
    }
  }

  return db.createTopic(supabase, {
    name: input.name.trim(),
    parent_id: input.parent_id,
    level,
  })
}

/** Topic umbenennen */
export async function renameTopic(supabase: Supabase, id: string, name: string) {
  return db.updateTopic(supabase, id, { name: name.trim() })
}

/** Topic löschen – prüft vorher ob Kinder existieren */
export async function deleteTopic(
  supabase: Supabase,
  id: string,
  force = false
) {
  const childCount = await db.getChildCount(supabase, id)

  if (childCount > 0 && !force) {
    throw new Error(
      `Dieses Topic hat ${childCount} untergeordnete Einträge. Mit force=true trotzdem löschen.`
    )
  }

  return db.deleteTopic(supabase, id)
}

/** Topics verschieben (parent_id + level aktualisieren) */
export async function moveTopic(
  supabase: Supabase,
  id: string,
  newParentId: string
) {
  const newParent = await db.getTopicById(supabase, newParentId)
  const newLevel = newParent.level + 1

  if (newLevel > 5) {
    throw new Error('Ziel-Ebene würde Maximumtiefe überschreiten')
  }

  return db.updateTopic(supabase, id, {
    parent_id: newParentId,
    level: newLevel,
  })
}

// ─── Analyse ─────────────────────────────────────────────────────────────────

export async function getDuplicates(supabase: Supabase) {
  return db.findDuplicateNames(supabase)
}

export async function getTreeStats(supabase: Supabase) {
  const levels = await Promise.all(
    [1, 2, 3, 4, 5].map(async (level) => {
      const topics = await db.getTopicsByLevel(supabase, level)
      return { level, count: topics.length }
    })
  )

  return {
    levels,
    total: levels.reduce((sum, l) => sum + l.count, 0),
  }
}
