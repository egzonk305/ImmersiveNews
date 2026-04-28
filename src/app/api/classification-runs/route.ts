import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

// GET /api/classification-runs?page=&pageSize=&status=
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const sp = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '25', 10)))
    const status = sp.get('status')

    let query = supabase
      .from('recent_classifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (status) query = query.eq('status', status)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total: count ?? 0 },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
