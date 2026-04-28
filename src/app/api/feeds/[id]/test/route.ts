import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { previewFeed } from '@/lib/services/feed.service'
import { formatError } from '@/lib/utils'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/feeds/[id]/test — Feed-Vorschau (kein Insert)
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: feed, error } = await supabase
      .from('rss_feeds')
      .select('id, url, name')
      .eq('id', id)
      .single()

    if (error || !feed) {
      return NextResponse.json({ error: 'Feed nicht gefunden' }, { status: 404 })
    }

    const items = await previewFeed(feed.url, 3)
    return NextResponse.json({
      data: {
        feed_name: feed.name,
        url: feed.url,
        items,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 502 })
  }
}
