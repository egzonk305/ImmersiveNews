import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifierSettingsUpdateSchema } from '@/lib/validators/classifier.schema'
import { formatError } from '@/lib/utils'
import type { ClassifierSettingsUpdate } from '@/lib/types/database.types'

// GET /api/classifier-settings — Singleton lesen
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('classifier_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}

// PATCH /api/classifier-settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const parsed = classifierSettingsUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const { data: current, error: fetchErr } = await supabase
      .from('classifier_settings')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchErr || !current) {
      // @ts-ignore — Supabase v2.100+: classifier_settings hat alle Felder optional → never
      const { data, error } = await (supabase.from('classifier_settings').insert(parsed.data).select().single())
      if (error) throw new Error(error.message)
      return NextResponse.json({ data })
    }

    // @ts-ignore — Supabase v2.100+: classifier_settings hat alle Felder optional → never
    const { data, error } = await (supabase.from('classifier_settings').update(parsed.data).eq('id', current.id).select().single())

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
