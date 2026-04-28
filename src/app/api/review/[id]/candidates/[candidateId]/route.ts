import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'
import { z } from 'zod'

type RouteContext = { params: Promise<{ id: string; candidateId: string }> }

const patchSchema = z.object({
  status: z.enum(['suggested', 'confirmed', 'rejected']).optional(),
  is_primary: z.boolean().optional(),
})

// PATCH /api/review/[id]/candidates/[candidateId]
// Bestätigen / Ablehnen / als primary markieren.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id, candidateId } = await params
    const supabase = await createClient()
    const body = await request.json()
    const parsed = patchSchema.parse(body)

    if (parsed.is_primary === true) {
      await supabase
        .from('incoming_item_topics')
        .update({ is_primary: false })
        .eq('incoming_item_id', id)
        .eq('is_primary', true)
    }

    const update: Record<string, unknown> = {}
    if (parsed.status) update.status = parsed.status
    if (parsed.is_primary !== undefined) update.is_primary = parsed.is_primary

    const { data, error } = await supabase
      .from('incoming_item_topics')
      .update(update)
      .eq('id', candidateId)
      .eq('incoming_item_id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}

// DELETE /api/review/[id]/candidates/[candidateId]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id, candidateId } = await params
    const supabase = await createClient()
    const { error } = await supabase
      .from('incoming_item_topics')
      .delete()
      .eq('id', candidateId)
      .eq('incoming_item_id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
