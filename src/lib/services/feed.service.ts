import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, RssFeed } from '@/lib/types/database.types'

export interface ParsedRssItem {
  title: string
  description: string | null
  content: string | null
  link: string | null
  pubDate: string | null
  guid: string | null
}

export interface FetchFeedResult {
  feed_id: string
  feed_name: string
  total_in_feed: number
  duplicates_skipped: number
  new_items_added: number
  error?: string
}

const INTERVAL_MS: Record<RssFeed['interval'], number> = {
  '15min': 15 * 60_000,
  hourly: 60 * 60_000,
  '6hours': 6 * 60 * 60_000,
  daily: 24 * 60 * 60_000,
}

export function shouldFetch(feed: RssFeed, now: Date = new Date()): boolean {
  if (!feed.is_active) return false
  if (!feed.last_fetched_at) return true
  const last = new Date(feed.last_fetched_at).getTime()
  return now.getTime() - last >= INTERVAL_MS[feed.interval]
}

function getTag(block: string, tag: string): string | null {
  const cdata = block.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i')
  )
  if (cdata) return cdata[1].trim()

  const simple = block.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  )
  if (simple) return simple[1].trim()

  if (tag === 'link') {
    const linkMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i)
    if (linkMatch) return linkMatch[1].trim()
  }
  return null
}

function stripHtml(s: string | null): string | null {
  if (!s) return s
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

export function parseRssXml(xml: string): ParsedRssItem[] {
  const items: ParsedRssItem[] = []
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]

    const title = stripHtml(getTag(block, 'title'))
    if (!title) continue

    const description =
      stripHtml(getTag(block, 'description')) ??
      stripHtml(getTag(block, 'summary'))

    const content =
      stripHtml(getTag(block, 'content:encoded')) ??
      stripHtml(getTag(block, 'content'))

    items.push({
      title: title.slice(0, 500),
      description: description?.slice(0, 2000) ?? null,
      content: content?.slice(0, 20_000) ?? null,
      link: getTag(block, 'link') ?? null,
      pubDate: getTag(block, 'pubDate') ?? getTag(block, 'published') ?? getTag(block, 'updated'),
      guid: getTag(block, 'guid') ?? getTag(block, 'id'),
    })
  }
  return items
}

function parsePubDate(pubDate: string | null): string | null {
  if (!pubDate) return null
  const d = new Date(pubDate)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

export async function fetchFeed(
  supabase: SupabaseClient<Database>,
  feedId: string
): Promise<FetchFeedResult> {
  const { data: feed, error: feedError } = await supabase
    .from('rss_feeds')
    .select('*')
    .eq('id', feedId)
    .single()

  if (feedError || !feed) {
    throw new Error('Feed nicht gefunden')
  }

  let xmlText: string
  try {
    const response = await fetch(feed.url, {
      headers: { 'User-Agent': 'ImmersiveNews/1.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    xmlText = await response.text()
  } catch (fetchErr) {
    const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Fetch fehlgeschlagen'
    await supabase
      .from('rss_feeds')
      .update({ last_error: errMsg, last_fetched_at: new Date().toISOString() })
      .eq('id', feedId)

    return {
      feed_id: feedId,
      feed_name: feed.name,
      total_in_feed: 0,
      duplicates_skipped: 0,
      new_items_added: 0,
      error: errMsg,
    }
  }

  const rssItems = parseRssXml(xmlText)

  if (rssItems.length === 0) {
    await supabase
      .from('rss_feeds')
      .update({
        last_error: 'Keine Items gefunden',
        last_fetched_at: new Date().toISOString(),
      })
      .eq('id', feedId)

    return {
      feed_id: feedId,
      feed_name: feed.name,
      total_in_feed: 0,
      duplicates_skipped: 0,
      new_items_added: 0,
      error: 'Keine Items im Feed',
    }
  }

  // Duplikate global (Unique-Index auf source_url) — wir prüfen vorab, um Inserts klein zu halten
  const urls = rssItems.map(i => i.link).filter((u): u is string => Boolean(u))
  const existingUrls = new Set<string>()
  if (urls.length > 0) {
    const { data: existing } = await supabase
      .from('incoming_items')
      .select('source_url')
      .in('source_url', urls)
    existing?.forEach(e => {
      if (e.source_url) existingUrls.add(e.source_url)
    })
  }

  const newItems = rssItems.filter(item => !item.link || !existingUrls.has(item.link))

  let inserted = 0
  if (newItems.length > 0) {
    const rows = newItems.map(item => ({
      title: item.title,
      description: item.description,
      content: item.content,
      source_type: 'rss' as const,
      source_id: feedId,
      feed_id: feedId,
      source_url: item.link,
      published_at: parsePubDate(item.pubDate),
      raw_data: item as unknown as Record<string, unknown>,
      status: 'pending' as const,
      processing_state: 'pending' as const,
    }))

    const { data: ins, error: insertError } = await supabase
      .from('incoming_items')
      .insert(rows)
      .select('id')

    if (insertError) {
      // Falls Unique-Index greift, Fehler trotzdem loggen, aber nicht alles abbrechen
      await supabase
        .from('rss_feeds')
        .update({
          last_error: `Insert: ${insertError.message}`,
          last_fetched_at: new Date().toISOString(),
        })
        .eq('id', feedId)

      return {
        feed_id: feedId,
        feed_name: feed.name,
        total_in_feed: rssItems.length,
        duplicates_skipped: rssItems.length - newItems.length,
        new_items_added: 0,
        error: insertError.message,
      }
    }
    inserted = ins?.length ?? 0
  }

  await supabase
    .from('rss_feeds')
    .update({
      last_fetched_at: new Date().toISOString(),
      last_error: null,
      item_count: (feed.item_count || 0) + inserted,
    })
    .eq('id', feedId)

  return {
    feed_id: feedId,
    feed_name: feed.name,
    total_in_feed: rssItems.length,
    duplicates_skipped: rssItems.length - newItems.length,
    new_items_added: inserted,
  }
}

export async function fetchAllDueFeeds(
  supabase: SupabaseClient<Database>
): Promise<FetchFeedResult[]> {
  const { data: feeds, error } = await supabase
    .from('rss_feeds')
    .select('*')
    .eq('is_active', true)

  if (error) throw new Error(error.message)
  if (!feeds || feeds.length === 0) return []

  const now = new Date()
  const due = feeds.filter(f => shouldFetch(f, now))

  const results: FetchFeedResult[] = []
  for (const feed of due) {
    try {
      results.push(await fetchFeed(supabase, feed.id))
    } catch (err) {
      results.push({
        feed_id: feed.id,
        feed_name: feed.name,
        total_in_feed: 0,
        duplicates_skipped: 0,
        new_items_added: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return results
}

export async function previewFeed(url: string, limit = 3): Promise<ParsedRssItem[]> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ImmersiveNews/1.0' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const xml = await response.text()
  return parseRssXml(xml).slice(0, limit)
}
