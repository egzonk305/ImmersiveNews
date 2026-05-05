import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as {
      olderThanDays: number
      statusFilter: 'all' | 'failed_only'
    }
    const { olderThanDays, statusFilter } = body

    // Validiere olderThanDays
    if (typeof olderThanDays !== 'number' || !Number.isFinite(olderThanDays) || olderThanDays < 1) {
      return NextResponse.json({ error: 'olderThanDays muss eine positive Zahl sein' }, { status: 400 })
    }

    const supabase = await createClient()
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('classification_runs')
      .delete()
      .lt('created_at', cutoff)

    if (statusFilter === 'failed_only') {
      query = query.in('status', ['failed', 'parse_error'])
    }

    const { error, count } = await query
    if (error) throw new Error(error.message)

    // Verwaiste classifier_prompts bereinigen
    const { error: rpcError } = await supabase.rpc('cleanup_orphaned_prompts')
    if (rpcError) console.error('cleanup_orphaned_prompts fehlgeschlagen:', rpcError.message)

    return NextResponse.json({ data: { affected: count ?? 0 } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
