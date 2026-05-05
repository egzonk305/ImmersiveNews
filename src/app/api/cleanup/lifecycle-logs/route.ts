import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json() as { olderThanDays: number }
    const { olderThanDays } = body

    if (typeof olderThanDays !== 'number' || !Number.isFinite(olderThanDays) || olderThanDays < 1) {
      return NextResponse.json({ error: 'olderThanDays muss eine positive Zahl sein' }, { status: 400 })
    }

    const supabase = await createClient()
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()

    const { error, count } = await supabase
      .from('lifecycle_runs')
      .delete({ count: 'exact' })
      .lt('started_at', cutoff)

    if (error) throw new Error(error.message)
    return NextResponse.json({ data: { affected: count ?? 0 } })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
