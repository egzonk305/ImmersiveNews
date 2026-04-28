import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyItem } from '@/lib/services/classifier.service'
import { formatError } from '@/lib/utils'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/review/[id]/reclassify — KI nochmal laufen lassen.
// Bestehende llm-Kandidaten werden in classifier.service.ts vor dem
// Insert gelöscht.
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const result = await classifyItem(supabase, id)
    return NextResponse.json({ data: result })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
