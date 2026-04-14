import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getTopicDetail,
  renameTopic,
  deleteTopic,
  moveTopic,
} from '@/lib/services/topic.service'
import { updateTopicSchema, moveTopicSchema, deleteTopicSchema } from '@/lib/validators/topic.schema'
import { formatError } from '@/lib/utils'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const detail = await getTopicDetail(supabase, id)
    return NextResponse.json({ data: detail })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 404 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    if (body.new_parent_id !== undefined) {
      const parsed = moveTopicSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
      }
      const topic = await moveTopic(supabase, id, parsed.data.new_parent_id)
      return NextResponse.json({ data: topic })
    }

    const parsed = updateTopicSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    if (parsed.data.name) {
      const topic = await renameTopic(supabase, id, parsed.data.name)
      return NextResponse.json({ data: topic })
    }

    return NextResponse.json({ error: 'Keine Änderung angegeben' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))

    const parsed = deleteTopicSchema.safeParse(body)
    const force = parsed.success ? parsed.data.force : false

    await deleteTopic(supabase, id, force)
    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = formatError(error)
    if (msg.includes('untergeordnete')) {
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
