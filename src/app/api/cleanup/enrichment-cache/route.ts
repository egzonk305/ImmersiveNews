import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { scope: 'all' | 'failed_only' }
    const { scope } = body

    if (!['all', 'failed_only'].includes(scope)) {
      return NextResponse.json({ error: 'Ungültiger Scope' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error, count } = scope === 'all'
      ? await supabase.from('enrichment_cache').delete().neq('url', '')
      : await supabase.from('enrichment_cache').delete().eq('status', 'failed')

    if (error) throw new Error(error.message)
    return NextResponse.json({ data: { affected: count ?? 0 } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
