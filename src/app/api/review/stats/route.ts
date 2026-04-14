import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

// GET /api/review/stats
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('incoming_items')
      .select('status')

    if (error) throw new Error(error.message)

    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      needs_edit: 0,
      total: 0,
    }

    for (const item of data ?? []) {
      const s = item.status as keyof typeof stats
      if (s in stats) stats[s]++
      stats.total++
    }

    return NextResponse.json({ data: stats })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
