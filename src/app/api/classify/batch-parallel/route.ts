import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { classifyParallel } from '@/lib/services/classifier.service'
import { formatError } from '@/lib/utils'

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  concurrency: z.number().int().min(1).max(10).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json())
    const supabase = await createClient()
    const { success, failed, results } = await classifyParallel(
      supabase,
      body.ids,
      body.concurrency ?? 3
    )

    return NextResponse.json({
      data: {
        total: body.ids.length,
        success,
        failed,
        auto_accepted: results.filter(result => result.auto_accepted).length,
        results,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
