import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { classifyAndBuildPathsForItem } from '@/lib/services/dynamic-news-path.service'
import { formatError } from '@/lib/utils'

const bodySchema = z.object({
  itemId: z.string().uuid(),
  force: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json())
    const supabase = await createClient()
    const result = await classifyAndBuildPathsForItem(supabase, body.itemId, {
      force: body.force,
    })

    return NextResponse.json({
      ok: result.status !== 'failed' && result.status !== 'parse_error',
      itemId: body.itemId,
      result,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: formatError(error) }, { status: 500 })
  }
}
