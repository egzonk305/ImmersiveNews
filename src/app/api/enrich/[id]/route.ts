import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/services/classifier.service'
import { enrichItem } from '@/lib/services/enrichment.service'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('incoming_items')
    .select('id, source_url, enrichment_status')
    .eq('id', id)
    .single()

  if (!item?.source_url) {
    return NextResponse.json({ error: 'Keine URL vorhanden' }, { status: 400 })
  }

  try {
    const settings = await getSettings(supabase)
    const content = await enrichItem(supabase, id, item.source_url, settings)
    return NextResponse.json({ ok: true, chars: content?.length ?? 0 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 }
    )
  }
}
