import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function DELETE() {
  try {
    const supabase = await createClient()

    // Nur Topics löschen, die nicht von incoming_items referenziert werden
    const { data: referenced, error: refError } = await supabase
      .from('incoming_items')
      .select('target_topic_id')
      .not('target_topic_id', 'is', null)

    if (refError) throw new Error(refError.message)

    const referencedIds = (referenced ?? [])
      .map((r: { target_topic_id: string | null }) => r.target_topic_id)
      .filter((id): id is string => id !== null)

    let query = supabase
      .from('topics')
      .delete({ count: 'exact' })
      .eq('topic_status', 'rejected')

    if (referencedIds.length > 0) {
      query = query.not('id', 'in', `(${referencedIds.join(',')})`)
    }

    const { error, count } = await query
    if (error) throw new Error(error.message)
    return NextResponse.json({ data: { affected: count ?? 0 } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
