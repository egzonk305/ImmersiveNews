import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllDueFeeds } from '@/lib/services/feed.service'
import { formatError } from '@/lib/utils'

// GET /api/cron/fetch-feeds — wird extern (Windows Task Scheduler / curl) getriggert.
// Holt alle aktiven Feeds, deren letzter Abruf das konfigurierte Intervall überschritten hat.
export async function GET(_req: NextRequest) {
  return runCron()
}

export async function POST(_req: NextRequest) {
  return runCron()
}

async function runCron() {
  try {
    const supabase = await createClient()
    const results = await fetchAllDueFeeds(supabase)
    const ok = results.filter(r => !r.error).length
    const failed = results.length - ok
    const inserted = results.reduce((sum, r) => sum + r.new_items_added, 0)

    return NextResponse.json({
      data: {
        feeds_checked: results.length,
        feeds_ok: ok,
        feeds_failed: failed,
        new_items_added: inserted,
        results,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
