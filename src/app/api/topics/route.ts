import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createTopic, getLeafTopics, getRootTopicsWithCount } from '@/lib/services/topic.service'
import { createTopicSchema } from '@/lib/validators/topic.schema'
import { formatError } from '@/lib/utils'

// GET /api/topics
// Query-Parameter: level, search, page, pageSize, view=roots|leaves
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const view = searchParams.get('view')
    const level = searchParams.get('level')
    const search = searchParams.get('search') ?? undefined
    const page = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50')

    if (view === 'roots') {
      const data = await getRootTopicsWithCount(supabase)
      return NextResponse.json({ data })
    }

    if (view === 'leaves' || level === '5') {
      const result = await getLeafTopics(supabase, { search, page, pageSize })
      return NextResponse.json(result)
    }

    // Standard: direkte DB-Abfrage mit optionalem Level-Filter
    let query = supabase.from('topics').select('*', { count: 'exact' })

    if (level) query = query.eq('level', parseInt(level))
    if (search) query = query.ilike('name', `%${search}%`)

    query = query.order('level').order('name').range(
      (page - 1) * pageSize,
      page * pageSize - 1
    )

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({ data, count, page, pageSize })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}

// POST /api/topics
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const parsed = createTopicSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      )
    }

    const topic = await createTopic(supabase, {
      name: parsed.data.name,
      parent_id: parsed.data.parent_id ?? null,
      description: parsed.data.description ?? null,
    })

    return NextResponse.json({ data: topic }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
