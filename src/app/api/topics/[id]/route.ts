import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getTopicDetail,
  patchTopic,
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

    if (parsed.data.name === undefined && parsed.data.description === undefined) {
      return NextResponse.json({ error: 'Keine Änderung angegeben' }, { status: 400 })
    }

    const topic = await patchTopic(supabase, id, {
      name: parsed.data.name,
      description: parsed.data.description,
    })
    return NextResponse.json({ data: topic })
  } catch (error) {
    const msg = formatError(error)
    if (msg.includes('Root-Topic')) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
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
    if (msg.includes('Root-Topic')) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    if (msg.includes('untergeordnete')) {
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
