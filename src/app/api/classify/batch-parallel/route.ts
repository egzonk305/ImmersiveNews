import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { classifyItemWithPath, type PathClassifyResult } from '@/lib/services/path-classifier.service'
import { formatError } from '@/lib/utils'

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  concurrency: z.number().int().min(1).max(5).optional().default(2),
})

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json())
    const supabase = await createClient()
    const concurrency = body.concurrency
    const results: PathClassifyResult[] = []

    for (let i = 0; i < body.ids.length; i += concurrency) {
      const chunk = body.ids.slice(i, i + concurrency)
      const chunkResults = await Promise.allSettled(
        chunk.map(id => classifyItemWithPath(supabase, id))
      )
      for (const r of chunkResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value)
        } else {
          results.push({
            item_id: chunk[chunkResults.indexOf(r)],
            status: 'failed',
            leaf_topic_id: null,
            path: [],
            headline: null,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            run_id: '',
          })
        }
      }
    }

    const success = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status !== 'success').length

    return NextResponse.json({
      data: { total: body.ids.length, success, failed, results },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
