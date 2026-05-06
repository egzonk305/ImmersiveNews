import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyItemWithPath } from '@/lib/services/path-classifier.service'
import { formatError } from '@/lib/utils'

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: item, error: insertError } = await supabase
      .from('incoming_items')
      .insert({
        title: '[SMOKE TEST] Bayern München gewinnt gegen Borussia Dortmund',
        description: 'In einem spannenden Bundesliga-Spiel setzte sich der FC Bayern München mit 3:1 gegen Borussia Dortmund durch. Robert Lewandowski erzielte zwei Tore.',
        source_type: 'rss',
        status: 'pending',
        processing_state: 'pending',
      })
      .select()
      .single()

    if (insertError || !item) throw new Error(`Smoke-Item konnte nicht angelegt werden: ${insertError?.message}`)

    const result = await classifyItemWithPath(supabase, item.id)
    return NextResponse.json({ item, result })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
