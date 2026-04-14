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
      .select('*, rss_feeds(id, name, url)')
      .eq('id', id)
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 404 })
  }
}

// PATCH /api/review/[id] — Status ändern / Freigeben / Ablehnen
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
      .select('*, rss_feeds(id, name, url)')
      .single()

    if (error) throw new Error(error.message)

    // Bei Freigabe: Topic in topics-Tabelle anlegen
    if (parsed.data.status === 'approved' && data) {
      const topicInsert: Record<string, unknown> = {
        name: data.title,
        parent_id: data.target_topic_id || null,
        level: 5, // Standard: Blatt-Ebene
      }

      // Wenn target_topic gesetzt, Level ableiten
      if (data.target_topic_id) {
        const { data: parent } = await supabase
          .from('topics')
          .select('level')
          .eq('id', data.target_topic_id)
          .single()

        if (parent) {
          topicInsert.level = Math.min(parent.level + 1, 5)
        }
      }

      const { error: topicError } = await supabase
        .from('topics')
        .insert(topicInsert)

      if (topicError) {
        // Nicht fatal – Item ist trotzdem freigegeben
        console.error('Topic-Erstellung nach Freigabe fehlgeschlagen:', topicError.message)
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

    const { error } = await supabase
      .from('incoming_items')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
