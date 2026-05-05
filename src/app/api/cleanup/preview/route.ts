import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function GET() {
  try {
    const supabase = await createClient()

    const [
      { count: pendingItems, error: e1 },
      { count: classificationLogs, error: e2 },
      { count: enrichmentCache, error: e3 },
      { count: rejectedTopics, error: e4 },
      { count: lifecycleLogs, error: e5 },
    ] = await Promise.all([
      supabase
        .from('incoming_items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('classification_runs')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('enrichment_cache')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('topic_status', 'rejected'),
      supabase
        .from('lifecycle_runs')
        .select('*', { count: 'exact', head: true })
        .lt('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    const firstError = e1 ?? e2 ?? e3 ?? e4 ?? e5
    if (firstError) throw new Error(firstError.message)

    return NextResponse.json({
      data: {
        pendingItems: pendingItems ?? 0,
        classificationLogs: classificationLogs ?? 0,
        enrichmentCache: enrichmentCache ?? 0,
        rejectedTopics: rejectedTopics ?? 0,
        lifecycleLogs: lifecycleLogs ?? 0,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
