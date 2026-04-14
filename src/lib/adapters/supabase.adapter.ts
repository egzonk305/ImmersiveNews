import type { Topic, TopicInsert, TopicUpdate } from '@/lib/types/database.types'
import type { TopicBreadcrumb } from '@/lib/types/app.types'

// Dieser Adapter wird serverseitig verwendet (API Routes, Server Components).
// Importiere den passenden Client je nach Kontext.

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

// ─── Lesen ────────────────────────────────────────────────────────────────────

/** Root-Knoten (Level 1, parent_id = null) */
export async function getRootTopics(db: SupabaseClient) {
  const { data, error } = await db
    .from('topics')
    .select('*')
    .is('parent_id', null)
    .order('name')

  if (error) throw new Error(`getRootTopics: ${error.message}`)
  return data as Topic[]
}

/** Direkte Kinder eines Topics */
export async function getChildren(db: SupabaseClient, parentId: string) {
  const { data, error } = await db
    .from('topics')
    .select('*')
    .eq('parent_id', parentId)
    .order('name')

  if (error) throw new Error(`getChildren: ${error.message}`)
  return data as Topic[]
}

/** Einzelnes Topic per ID */
export async function getTopicById(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from('topics')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`getTopicById: ${error.message}`)
  return data as Topic
}

/** Alle Topics eines bestimmten Levels */
export async function getTopicsByLevel(db: SupabaseClient, level: number) {
  const { data, error } = await db
    .from('topics')
    .select('*')
    .eq('level', level)
    .order('name')

  if (error) throw new Error(`getTopicsByLevel: ${error.message}`)
  return data as Topic[]
}

/** Suche nach Name (case-insensitive) */
export async function searchTopics(db: SupabaseClient, query: string, level?: number) {
  let q = db
    .from('topics')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('level')
    .order('name')
    .limit(50)

  if (level !== undefined) {
    q = q.eq('level', level)
  }

  const { data, error } = await q
  if (error) throw new Error(`searchTopics: ${error.message}`)
  return data as Topic[]
}

/** Kompletten Teilbaum ab einem Knoten laden (via RPC-Funktion) */
export async function getTopicSubtree(db: SupabaseClient, rootId: string) {
  const { data, error } = await db.rpc('get_topic_subtree', { root_id: rootId })
  if (error) throw new Error(`getTopicSubtree: ${error.message}`)
  return data as Topic[]
}

/** Breadcrumb-Pfad zu einem Topic (via RPC-Funktion) */
export async function getTopicAncestors(
  db: SupabaseClient,
  topicId: string
): Promise<TopicBreadcrumb> {
  const { data, error } = await db.rpc('get_topic_ancestors', { topic_id: topicId })
  if (error) throw new Error(`getTopicAncestors: ${error.message}`)
  return (data as TopicBreadcrumb).sort((a, b) => a.level - b.level)
}

/** Anzahl Kinder eines Topics */
export async function getChildCount(db: SupabaseClient, parentId: string) {
  const { count, error } = await db
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', parentId)

  if (error) throw new Error(`getChildCount: ${error.message}`)
  return count ?? 0
}

/** Duplikate finden (gleicher Name, unterschiedliche IDs) */
export async function findDuplicateNames(db: SupabaseClient) {
  // Fallback ohne RPC: alle holen und in JS gruppieren
  const { data, error } = await db
    .from('topics')
    .select('*')
    .order('name')

  if (error) throw new Error(`findDuplicateNames: ${error.message}`)

  const groups = new Map<string, Topic[]>()
  for (const topic of (data as Topic[])) {
    const key = topic.name.toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(topic)
  }

  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([name, items]) => ({ name, items }))
}

// ─── Schreiben ─────────────────────────────────────────────────────────────────

/** Neues Topic anlegen */
export async function createTopic(db: SupabaseClient, input: TopicInsert) {
  const { data, error } = await db
    .from('topics')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`createTopic: ${error.message}`)
  return data as Topic
}

/** Topic aktualisieren */
export async function updateTopic(
  db: SupabaseClient,
  id: string,
  input: TopicUpdate
) {
  const { data, error } = await db
    .from('topics')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateTopic: ${error.message}`)
  return data as Topic
}

/** Topic löschen (löscht auch alle Kinder via CASCADE, falls so eingerichtet) */
export async function deleteTopic(db: SupabaseClient, id: string) {
  const { error } = await db.from('topics').delete().eq('id', id)
  if (error) throw new Error(`deleteTopic: ${error.message}`)
}

/** Mehrere Topics auf einmal einfügen (für Import) */
export async function bulkInsertTopics(db: SupabaseClient, items: TopicInsert[]) {
  const { data, error } = await db
    .from('topics')
    .insert(items)
    .select()

  if (error) throw new Error(`bulkInsertTopics: ${error.message}`)
  return data as Topic[]
}
