import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { formatError } from '@/lib/utils'

const bulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Mindestens eine ID erforderlich'),
  action: z.enum(['approve', 'reject', 'delete']),
  target_topic_id: z.string().uuid().optional().nullable(),
})

// POST /api/review/bulk
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const parsed = bulkActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { ids, action, target_topic_id } = parsed.data
    let affected = 0

    if (action === 'delete') {
      const { error } = await supabase
        .from('incoming_items')
        .delete()
        .in('id', ids)

      if (error) throw new Error(error.message)
      affected = ids.length
    } else {
      const status = action === 'approve' ? 'approved' : 'rejected'
      const updateData: Record<string, unknown> = {
        status,
        reviewed_at: new Date().toISOString(),
      }

      if (target_topic_id) {
        updateData.target_topic_id = target_topic_id
      }

      const { error } = await supabase
        .from('incoming_items')
        .update(updateData)
        .in('id', ids)

      if (error) throw new Error(error.message)
      affected = ids.length

      // Bei Massen-Freigabe: Topics anlegen
      if (action === 'approve') {
        const { data: items } = await supabase
          .from('incoming_items')
          .select('title, target_topic_id')
          .in('id', ids)

        if (items && items.length > 0) {
          const topicInserts = items.map(item => ({
            name: item.title,
            parent_id: item.target_topic_id || target_topic_id || null,
            level: 5,
          }))

          await supabase.from('topics').insert(topicInserts)
        }
      }
    }

    return NextResponse.json({ data: { affected } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
