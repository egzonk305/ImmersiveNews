import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { formatError } from '@/lib/utils'

type RouteContext = { params: Promise<{ id: string }> }

const updateFeedSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  url: z.string().url().trim().optional(),
  interval: z.enum(['15min', 'hourly', '6hours', 'daily']).optional(),
  is_active: z.boolean().optional(),
})

// GET /api/feeds/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 404 })
  }
}

// PATCH /api/feeds/[id]
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const parsed = updateFeedSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('rss_feeds')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}

// DELETE /api/feeds/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Lösche zugehörige incoming_items erst
    await supabase
      .from('incoming_items')
      .delete()
      .eq('source_id', id)

    const { error } = await supabase
      .from('rss_feeds')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
