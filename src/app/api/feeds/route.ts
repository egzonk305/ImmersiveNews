import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { formatError } from '@/lib/utils'

const createFeedSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200).trim(),
  url: z.string().url('Ungültige URL').trim(),
  interval: z.enum(['15min', 'hourly', '6hours', 'daily']).default('hourly'),
  is_active: z.boolean().default(true),
})

// GET /api/feeds — Alle Feeds auflisten
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('rss_feeds')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}

// POST /api/feeds — Neuen Feed anlegen
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const parsed = createFeedSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    // Prüfe ob URL bereits existiert
    const { data: existing } = await supabase
      .from('rss_feeds')
      .select('id')
      .eq('url', parsed.data.url)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Ein Feed mit dieser URL existiert bereits' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('rss_feeds')
      .insert(parsed.data)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
