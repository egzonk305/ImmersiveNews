import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyAllPending, classifyBatch } from '@/lib/services/classifier.service'
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

    const results =
      'all_pending' in parsed
        ? await classifyAllPending(supabase, parsed.limit ?? 25)
        : await classifyBatch(supabase, parsed.ids)

    const ok = results.filter(r => r.status === 'success').length
    const failed = results.length - ok

    return NextResponse.json({
      data: {
        total: results.length,
        success: ok,
        failed,
        auto_accepted: results.filter(r => r.auto_accepted).length,
        results,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
