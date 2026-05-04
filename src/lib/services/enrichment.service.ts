import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ClassifierSettings } from '@/lib/types/database.types'

async function fetchAndExtract(url: string, timeoutMs: number): Promise<string | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ImmersiveNews/1.0' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const html = await response.text()
  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()
  return article?.textContent?.replace(/\s+/g, ' ').trim() ?? null
}

export async function enrichItem(
  supabase: SupabaseClient<Database>,
  itemId: string,
  sourceUrl: string,
  settings: ClassifierSettings
): Promise<string | null> {
  // Check cache first
  const { data: cached } = await supabase
    .from('enrichment_cache')
    .select('content, status')
    .eq('url', sourceUrl)
    .maybeSingle()

  if (cached?.status === 'success' && cached.content) {
    const truncated = cached.content.slice(0, settings.enrichment_max_chars)
    await supabase
      .from('incoming_items')
      .update({
        enrichment_status: 'success',
        enriched_content: truncated,
        enriched_at: new Date().toISOString(),
      })
      .eq('id', itemId)
    return truncated
  }

  await supabase
    .from('incoming_items')
    .update({ enrichment_status: 'pending' })
    .eq('id', itemId)

  try {
    const raw = await fetchAndExtract(sourceUrl, settings.enrichment_fetch_timeout_ms)
    const truncated = raw ? raw.slice(0, settings.enrichment_max_chars) : null

    await supabase.from('enrichment_cache').upsert(
      {
        url: sourceUrl,
        fetched_at: new Date().toISOString(),
        content: truncated,
        status: (truncated ? 'success' : 'failed') as 'success' | 'failed',
        error: truncated ? null : 'Kein Inhalt extrahiert',
        byte_length: truncated ? Buffer.byteLength(truncated, 'utf8') : 0,
      } as Database['public']['Tables']['enrichment_cache']['Insert'] & { byte_length: number },
      { onConflict: 'url' }
    )

    await supabase
      .from('incoming_items')
      .update({
        enrichment_status: truncated ? 'success' : 'failed',
        enriched_content: truncated,
        enrichment_error: truncated ? null : 'Kein Inhalt extrahiert',
        enriched_at: new Date().toISOString(),
      })
      .eq('id', itemId)

    return truncated
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('enrichment_cache').upsert(
      {
        url: sourceUrl,
        fetched_at: new Date().toISOString(),
        content: null,
        status: 'failed' as const,
        error: msg,
        byte_length: 0,
      } as Database['public']['Tables']['enrichment_cache']['Insert'] & { byte_length: number },
      { onConflict: 'url' }
    )
    await supabase
      .from('incoming_items')
      .update({ enrichment_status: 'failed', enrichment_error: msg })
      .eq('id', itemId)
    return null
  }
}
