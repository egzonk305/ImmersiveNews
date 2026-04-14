import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'
import { z } from 'zod'

const reviewActionSchema = z.object({
  status: z.enum(['approved', 'rejected', 'needs_edit']),
  target_topic_id: z.string().uuid().optional().nullable(),
})

// GET /api/review — Alle Incoming Items (mit Filter)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const source = searchParams.get('source')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    let query = supabase
      .from('incoming_items')
      .select('*, rss_feeds(id, name, url)', { count: 'exact' })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (source) {
      query = query.eq('source_type', source)
    }

    const start = (page - 1) * pageSize
    query = query
      .order('created_at', { ascending: false })
      .range(start, start + pageSize - 1)

    const { data, count, error } = await query

    if (error) throw new Error(error.message)

    return NextResponse.json({
      data: data ?? [],
      count: count ?? 0,
      page,
      pageSize,
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}

// GET /api/review/stats — Statistiken
export async function HEAD() {
  // Wir nutzen einen separaten Endpunkt dafür
  return new NextResponse(null, { status: 405 })
}
