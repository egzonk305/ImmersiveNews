import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/classification-runs/[id] — Detail mit Prompt + Response
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('classification_runs')
      .select('*, incoming_items(id, title, description, source_url)')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 404 })
  }
}
