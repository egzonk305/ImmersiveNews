import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { classifyAllPendingWithPath } from '@/lib/services/path-classifier.service'
import { formatError } from '@/lib/utils'

const bodySchema = z.object({
  limit: z.number().int().min(1).max(500).optional().default(25),
})

// POST /api/classify/pending
export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const supabase = await createClient()
    const results = await classifyAllPendingWithPath(supabase, body.limit)
    const ok = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status !== 'success').length
    return NextResponse.json({
      data: { total: results.length, success: ok, failed, results },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
