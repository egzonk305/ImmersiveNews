import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { formatError } from '@/lib/utils'

type RouteContext = { params: Promise<{ id: string }> }

const reviewActionSchema = z.object({
  status: z.enum(['approved', 'rejected', 'needs_edit', 'pending']),
  target_topic_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(500).trim().optional(),
  description: z.string().max(2000).trim().optional().nullable(),
})

// GET /api/review/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('incoming_items')
      .select(
        `*,
        rss_feeds:feed_id(id, name, url),
        candidates:incoming_item_topics(
          id, topic_id, rank, confidence, is_primary, reason, source, status, created_at,
          topics:topic_id(id, name, level)
        )`
      )
      .eq('id', id)
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 404 })
  }
}

// PATCH /api/review/[id] — Status / Title / Description
// Bei status='approved' wird KEIN neues Topic erzeugt; nur die bestehende
// Zuordnung in incoming_item_topics wird ggf. bestätigt. Wird ein
// target_topic_id übergeben, wird eine manuelle Zuordnung als primary angelegt.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const parsed = reviewActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {
      status: parsed.data.status,
    }

    if (parsed.data.status === 'approved' || parsed.data.status === 'rejected') {
      updateData.reviewed_at = new Date().toISOString()
    }
    if (parsed.data.status === 'approved') {
      updateData.processing_state = 'done'
    }

    if (parsed.data.target_topic_id !== undefined) {
      updateData.target_topic_id = parsed.data.target_topic_id
    }
    if (parsed.data.title) {
      updateData.title = parsed.data.title
    }
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description
    }

    const { data, error } = await supabase
      .from('incoming_items')
      .update(updateData)
      .eq('id', id)
      .select('*, rss_feeds:feed_id(id, name, url)')
      .single()

    if (error) throw new Error(error.message)

    if (parsed.data.status === 'approved' && data) {
      if (parsed.data.target_topic_id) {
        // Manuelle Zuordnung: bestehende primary deaktivieren, neue setzen
        await supabase
          .from('incoming_item_topics')
          .update({ is_primary: false })
          .eq('incoming_item_id', id)
          .eq('is_primary', true)

        await supabase.from('incoming_item_topics').upsert(
          {
            incoming_item_id: id,
            topic_id: parsed.data.target_topic_id,
            rank: 1,
            is_primary: true,
            source: 'manual',
            status: 'confirmed',
            reason: 'Manuell beim Review zugeordnet',
          },
          { onConflict: 'incoming_item_id,topic_id' }
        )
      } else {
        // Implizite Bestätigung: bestehenden primary-Kandidat confirmen
        const { data: primary } = await supabase
          .from('incoming_item_topics')
          .select('topic_id')
          .eq('incoming_item_id', id)
          .eq('is_primary', true)
          .maybeSingle()

        if (primary?.topic_id) {
          await supabase
            .from('incoming_item_topics')
            .update({ status: 'confirmed' })
            .eq('incoming_item_id', id)
            .eq('topic_id', primary.topic_id)

          await supabase
            .from('incoming_items')
            .update({ target_topic_id: primary.topic_id })
            .eq('id', id)
        }
      }
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}

// DELETE /api/review/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase.from('incoming_items').delete().eq('id', id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
