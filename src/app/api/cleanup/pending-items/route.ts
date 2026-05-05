import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as {
      olderThanDays: number
      action: 'reject' | 'delete'
      onlyWithoutTopic: boolean
    }
    const { olderThanDays, action, onlyWithoutTopic } = body

    if (typeof olderThanDays !== 'number' || !Number.isFinite(olderThanDays) || olderThanDays < 1) {
      return NextResponse.json({ error: 'olderThanDays muss eine positive Zahl sein' }, { status: 400 })
    }

    if (!['reject', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
    }

    const supabase = await createClient()
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('incoming_items')
      .select('id', { count: 'exact' })
      .eq('status', 'pending')
      .lt('created_at', cutoff)

    if (onlyWithoutTopic) {
      query = query.is('target_topic_id', null)
    }

    const { data: items, error: selectError } = await query
    if (selectError) throw new Error(selectError.message)

    const ids = (items ?? []).map((i: { id: string }) => i.id)
    if (ids.length === 0) {
      return NextResponse.json({ data: { affected: 0 } })
    }

    if (action === 'reject') {
      const { error } = await supabase
        .from('incoming_items')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from('incoming_items')
        .delete()
        .in('id', ids)
      if (error) throw new Error(error.message)
    }

    return NextResponse.json({ data: { affected: ids.length } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
