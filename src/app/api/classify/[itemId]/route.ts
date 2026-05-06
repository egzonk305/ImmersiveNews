import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyItemWithPath } from '@/lib/services/path-classifier.service'
import { formatError } from '@/lib/utils'

type RouteContext = { params: Promise<{ itemId: string }> }

// POST /api/classify/[itemId]
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { itemId } = await params
    const supabase = await createClient()
    const result = await classifyItemWithPath(supabase, itemId)
    return NextResponse.json({ data: result })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
