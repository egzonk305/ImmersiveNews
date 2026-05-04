import { createClient } from '@/lib/supabase/server'
import { runLifecycle } from '@/lib/services/lifecycle.service'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dry_run') === 'true'

  const supabase = await createClient()
  try {
    const result = await runLifecycle(supabase, dryRun)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fehler' },
      { status: 500 }
    )
  }
}
