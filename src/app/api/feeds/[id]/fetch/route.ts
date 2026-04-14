import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

type RouteContext = { params: Promise<{ id: string }> }

// Einfacher RSS/Atom-Parser (ohne externe Abhängigkeit)
function parseRSSItems(xml: string): Array<{
  title: string
  description: string | null
  link: string | null
  pubDate: string | null
}> {
  const items: Array<{
    title: string
    description: string | null
    link: string | null
    pubDate: string | null
  }> = []

  // RSS 2.0 <item> oder Atom <entry>
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]

    const getTag = (tag: string): string | null => {
      // Versuche erst CDATA, dann normalen Inhalt
      const cdataMatch = block.match(
        new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i')
      )
      if (cdataMatch) return cdataMatch[1].trim()

      const simpleMatch = block.match(
        new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
      )
      if (simpleMatch) return simpleMatch[1].trim()

      // Atom self-closing link
      if (tag === 'link') {
        const linkMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i)
        if (linkMatch) return linkMatch[1].trim()
      }

      return null
    }

    const title = getTag('title')
    if (!title) continue

    items.push({
      title: title.replace(/<[^>]+>/g, ''), // HTML-Tags entfernen
      description: getTag('description') || getTag('summary') || getTag('content'),
      link: getTag('link') || getTag('guid'),
      pubDate: getTag('pubDate') || getTag('published') || getTag('updated'),
    })
  }

  return items
}

// POST /api/feeds/[id]/fetch — Feed abrufen und Items in Queue legen
export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Feed laden
    const { data: feed, error: feedError } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('id', id)
      .single()

    if (feedError || !feed) {
      return NextResponse.json({ error: 'Feed nicht gefunden' }, { status: 404 })
    }

    // RSS abrufen
    let xmlText: string
    try {
      const response = await fetch(feed.url, {
        headers: { 'User-Agent': 'AdminPlatform/1.0' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      xmlText = await response.text()
    } catch (fetchErr) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Fetch fehlgeschlagen'
      
      // Fehler im Feed speichern
      await supabase
        .from('rss_feeds')
        .update({ last_error: errMsg, last_fetched_at: new Date().toISOString() })
        .eq('id', id)

      return NextResponse.json({ error: `Feed-Abruf fehlgeschlagen: ${errMsg}` }, { status: 502 })
    }

    // RSS parsen
    const rssItems = parseRSSItems(xmlText)

    if (rssItems.length === 0) {
      await supabase
        .from('rss_feeds')
        .update({ last_error: 'Keine Items gefunden', last_fetched_at: new Date().toISOString() })
        .eq('id', id)

      return NextResponse.json({ error: 'Keine Items im Feed gefunden' }, { status: 422 })
    }

    // Duplikate prüfen (anhand source_url)
    const existingUrls = new Set<string>()
    if (rssItems.some(item => item.link)) {
      const urls = rssItems.map(i => i.link).filter(Boolean) as string[]
      const { data: existing } = await supabase
        .from('incoming_items')
        .select('source_url')
        .eq('source_id', id)
        .in('source_url', urls)

      existing?.forEach(e => {
        if (e.source_url) existingUrls.add(e.source_url)
      })
    }

    // Nur neue Items einfügen
    const newItems = rssItems.filter(
      item => !item.link || !existingUrls.has(item.link)
    )

    let insertedCount = 0
    if (newItems.length > 0) {
      const toInsert = newItems.map(item => ({
        title: item.title.slice(0, 500),
        description: item.description?.slice(0, 2000) || null,
        source_type: 'rss' as const,
        source_id: id,
        source_url: item.link || null,
        raw_data: item as Record<string, unknown>,
        status: 'pending' as const,
      }))

      const { data: inserted, error: insertError } = await supabase
        .from('incoming_items')
        .insert(toInsert)
        .select()

      if (insertError) throw new Error(insertError.message)
      insertedCount = inserted?.length ?? 0
    }

    // Feed-Status aktualisieren
    await supabase
      .from('rss_feeds')
      .update({
        last_fetched_at: new Date().toISOString(),
        last_error: null,
        item_count: (feed.item_count || 0) + insertedCount,
      })
      .eq('id', id)

    return NextResponse.json({
      data: {
        total_in_feed: rssItems.length,
        duplicates_skipped: rssItems.length - newItems.length,
        new_items_added: insertedCount,
      }
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
