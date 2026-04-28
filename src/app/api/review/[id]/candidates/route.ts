import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { candidateAddSchema } from '@/lib/validators/classifier.schema'
import { formatError } from '@/lib/utils'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/review/[id]/candidates
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('incoming_item_topics')
      .select('*, topics:topic_id(id, name, level)')
      .eq('incoming_item_id', id)
      .order('rank', { ascending: true })
    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}

// POST /api/review/[id]/candidates — manuelle Zuordnung hinzufügen
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const parsed = candidateAddSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { topic_id, is_primary, reason } = parsed.data

    // existiert Topic überhaupt?
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('id', topic_id)
      .single()
    if (!topic) {
      return NextResponse.json({ error: 'Topic existiert nicht' }, { status: 404 })
    }

    if (is_primary) {
      await supabase
        .from('incoming_item_topics')
        .update({ is_primary: false })
        .eq('incoming_item_id', id)
        .eq('is_primary', true)
    }

    const { data, error } = await supabase
      .from('incoming_item_topics')
      .upsert(
        {
          incoming_item_id: id,
          topic_id,
          rank: 1,
          is_primary: is_primary ?? false,
          source: 'manual',
          status: 'confirmed',
          reason: reason ?? 'Manuell hinzugefügt',
        },
        { onConflict: 'incoming_item_id,topic_id' }
      )
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
