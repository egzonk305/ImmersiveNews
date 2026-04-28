import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

// GET /api/dashboard/stats — aggregierte Kennzahlen für die Übersicht.
export async function GET() {
  try {
    const supabase = await createClient()

    const [
      stats,
      itemsPerRoot,
      recentRuns,
      recentFeeds,
      lowConfidence,
      totalRuns,
      successRuns,
    ] = await Promise.all([
      supabase.from('dashboard_stats').select('*').single(),
      supabase.from('items_per_root').select('*'),
      supabase
        .from('classification_runs')
        .select('id, status, model, duration_ms, error_message, created_at, incoming_item_id')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('rss_feeds')
        .select('id, name, last_fetched_at, last_error, item_count, is_active')
        .order('last_fetched_at', { ascending: false, nullsFirst: false })
        .limit(5),
      supabase.from('low_confidence_items').select('*').limit(10),
      supabase.from('classification_runs').select('*', { count: 'exact', head: true }),
      supabase.from('classification_runs').select('*', { count: 'exact', head: true }).eq('status', 'success'),
    ])

    const total = totalRuns.count ?? 0
    const ok = successRuns.count ?? 0

    return NextResponse.json({
      data: {
        stats: stats.data ?? null,
        itemsPerRoot: itemsPerRoot.data ?? [],
        recentRuns: recentRuns.data ?? [],
        recentFeeds: recentFeeds.data ?? [],
        lowConfidence: lowConfidence.data ?? [],
        runStats: { total_runs: total, successful_runs: ok, failed_runs: total - ok },
      },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
