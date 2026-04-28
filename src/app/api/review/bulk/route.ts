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
// Wichtig: Approve erzeugt KEINE neuen Topics. Wird optional ein
// target_topic_id übergeben, wird je Item eine manuelle Zuordnung in
// incoming_item_topics als primary gesetzt.
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
      if (action === 'approve') {
        updateData.processing_state = 'done'
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

      if (action === 'approve' && target_topic_id) {
        // bestehende primaries auf false setzen
        await supabase
          .from('incoming_item_topics')
          .update({ is_primary: false })
          .in('incoming_item_id', ids)
          .eq('is_primary', true)

        const inserts = ids.map(itemId => ({
          incoming_item_id: itemId,
          topic_id: target_topic_id,
          rank: 1,
          is_primary: true,
          source: 'manual' as const,
          status: 'confirmed' as const,
          reason: 'Manuell beim Bulk-Review zugeordnet',
        }))

        await supabase
          .from('incoming_item_topics')
          .upsert(inserts, { onConflict: 'incoming_item_id,topic_id' })
      }
    }

    return NextResponse.json({ data: { affected } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
