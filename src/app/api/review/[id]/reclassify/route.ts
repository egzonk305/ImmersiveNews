import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyItemWithPath } from '@/lib/services/path-classifier.service'
import { formatError } from '@/lib/utils'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/review/[id]/reclassify
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const result = await classifyItemWithPath(supabase, id)
    return NextResponse.json({ data: result })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
