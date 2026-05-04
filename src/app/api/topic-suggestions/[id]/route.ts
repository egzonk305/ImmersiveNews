import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({
  action: z.enum(['approve', 'reject']),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })

  const supabase = await createClient()
  const newStatus = body.data.action === 'approve' ? 'active' : 'rejected'

  const { data, error } = await supabase
    .from('topics')
    .update({ topic_status: newStatus })
    .eq('id', id)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Topic nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true, topic_status: newStatus })
}
