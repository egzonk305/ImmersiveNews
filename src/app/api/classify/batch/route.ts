import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  classifyBatchWithPath,
  classifyAllPendingWithPath,
} from '@/lib/services/path-classifier.service'
import { formatError } from '@/lib/utils'
import { z } from 'zod'

const bodySchema = z.union([
  z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
  }),
  z.object({
    all_pending: z.literal(true),
    limit: z.number().int().min(1).max(100).optional(),
  }),
])

// POST /api/classify/batch
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const parsed = bodySchema.parse(body)

    if ('all_pending' in parsed) {
      const results = await classifyAllPendingWithPath(supabase, parsed.limit ?? 25)
      const ok = results.filter(r => r.status === 'success').length
      const failed = results.filter(r => r.status !== 'success').length
      return NextResponse.json({ data: { total: results.length, success: ok, failed, results } })
    }

    const results = await classifyBatchWithPath(supabase, parsed.ids)
    const ok = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status !== 'success').length

    return NextResponse.json({
      data: { total: results.length, success: ok, failed, results },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
