import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database.types'
import { generate, OllamaError } from '@/lib/services/ollama.client'
import { enrichItem } from '@/lib/services/enrichment.service'
import { buildPathClassifierPrompt } from '@/lib/prompts/path-classifier-prompt'
import { pathClassificationSchema } from '@/lib/validators/classifier.schema'
import { getSettings } from '@/lib/services/classifier.service'

export interface PathClassifyResult {
  item_id: string
  status: 'success' | 'failed' | 'parse_error'
  leaf_topic_id: string | null
  path: string[]
  headline: string | null
  error?: string
  run_id: string
}

function tryParsePathJson(text: string): unknown | null {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*/g, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (m) try { return JSON.parse(m[0]) } catch { /* weiter */ }
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>

async function findExistingTopic(
  sb: AnySupabase,
  name: string,
  parentId: string | null
): Promise<string | null> {
  const base = sb.from('topics').select('id').ilike('name', name).eq('topic_status', 'active')
  const result = parentId === null
    ? await base.is('parent_id', null).maybeSingle()
    : await base.eq('parent_id', parentId).maybeSingle()
  return (result.data as { id: string } | null)?.id ?? null
}

async function createTopicNode(
  sb: AnySupabase,
  name: string,
  parentId: string | null,
  level: number
): Promise<string> {
  const result = await sb
    .from('topics')
    .insert({ name, parent_id: parentId, level, topic_status: 'active', auto_created: true })
    .select('id')
    .single()
  if (result.error || !result.data) throw new Error(`Topic-Anlage fehlgeschlagen (${name}): ${result.error?.message}`)
  return (result.data as { id: string }).id
}

async function findOrCreateTopicPath(
  supabase: SupabaseClient<Database>,
  path: string[]
): Promise<string> {
  const sb = supabase as AnySupabase
  let parentId: string | null = null
  let currentId = ''

  for (let i = 0; i < path.length; i++) {
    const name = path[i].trim()
    const existingId = await findExistingTopic(sb, name, parentId)

    if (existingId) {
      currentId = existingId
      parentId = existingId
    } else {
      const newId = await createTopicNode(sb, name, parentId, i + 1)
      currentId = newId
      parentId = newId
    }
  }

  return currentId
}

export async function classifyItemWithPath(
  supabase: SupabaseClient<Database>,
  itemId: string
): Promise<PathClassifyResult> {
  const settings = await getSettings(supabase)

  const { data: item, error: itemError } = await supabase
    .from('incoming_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (itemError || !item) throw new Error(`Item nicht gefunden: ${itemError?.message}`)

  await supabase
    .from('incoming_items')
    .update({ processing_state: 'processing', processing_error: null })
    .eq('id', itemId)

  let content = item.enriched_content ?? item.content ?? null
  if (
    settings.enrichment_enabled_global &&
    item.source_url &&
    item.enrichment_status !== 'success' &&
    (item.description?.length ?? 0) < (settings.enrichment_min_description_chars ?? 200)
  ) {
    try {
      content = await enrichItem(supabase, itemId, item.source_url, settings)
    } catch { /* Klassifizierung ohne Enrichment fortsetzen */ }
  }

  const prompt = buildPathClassifierPrompt({
    title: item.title,
    description: item.description ?? null,
    content,
  })

  const startTs = Date.now()
  let rawResponse = ''
  let runStatus: 'success' | 'failed' | 'parse_error' = 'parse_error'
  let errorMessage: string | null = null
  let leafTopicId: string | null = null
  let resultPath: string[] = []
  let resultHeadline: string | null = null
  let parsedJson: unknown = null

  try {
    const ollamaResult = await generate({
      baseUrl: settings.ollama_base_url,
      model: settings.model_name,
      prompt,
      temperature: settings.temperature ?? 0.1,
      numCtx: settings.num_ctx ?? 8192,
      numPredict: settings.num_predict ?? 500,
      timeoutMs: settings.timeout_ms ?? 360000,
    })
    rawResponse = ollamaResult.response

    const parsed = tryParsePathJson(rawResponse)
    if (!parsed) {
      errorMessage = 'JSON konnte nicht geparst werden'
    } else {
      parsedJson = parsed
      const validated = pathClassificationSchema.safeParse(parsed)
      if (!validated.success) {
        errorMessage = validated.error.errors
          .map(e => `${e.path.join('.') || 'root'}: ${e.message}`)
          .join(' | ')
        runStatus = 'parse_error'
      } else {
        const { path, headline, summary } = validated.data
        resultPath = path
        resultHeadline = headline

        leafTopicId = await findOrCreateTopicPath(supabase, path)

        await supabase
          .from('incoming_items')
          .update({
            processing_state: 'done',
            status: 'approved',
            target_topic_id: leafTopicId,
            ai_headline: headline,
            ai_description: summary,
            ai_summary_short: summary.slice(0, 200),
            reviewed_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            processing_error: null,
          })
          .eq('id', itemId)

        runStatus = 'success'
      }
    }
  } catch (err) {
    errorMessage = err instanceof OllamaError
      ? err.message
      : err instanceof Error ? err.message : String(err)
    runStatus = 'failed'
  }

  if (runStatus !== 'success') {
    await supabase
      .from('incoming_items')
      .update({ processing_state: 'failed', processing_error: errorMessage })
      .eq('id', itemId)
  }

  const durationMs = Date.now() - startTs

  const { data: runData } = await supabase
    .from('classification_runs')
    .insert({
      incoming_item_id: itemId,
      model: settings.model_name,
      status: runStatus,
      duration_ms: durationMs,
      prompt,
      raw_response: rawResponse || null,
      parsed_response: (parsedJson as Json) ?? null,
      error_message: errorMessage,
    })
    .select('id')
    .single()

  return {
    item_id: itemId,
    status: runStatus,
    leaf_topic_id: leafTopicId,
    path: resultPath,
    headline: resultHeadline,
    error: errorMessage ?? undefined,
    run_id: runData?.id ?? '',
  }
}

export async function classifyBatchWithPath(
  supabase: SupabaseClient<Database>,
  ids: string[]
): Promise<PathClassifyResult[]> {
  const results: PathClassifyResult[] = []
  for (const id of ids) {
    try {
      results.push(await classifyItemWithPath(supabase, id))
    } catch (err) {
      results.push({
        item_id: id,
        status: 'failed',
        leaf_topic_id: null,
        path: [],
        headline: null,
        error: err instanceof Error ? err.message : String(err),
        run_id: '',
      })
    }
  }
  return results
}

export async function classifyAllPendingWithPath(
  supabase: SupabaseClient<Database>,
  limit = 25
): Promise<PathClassifyResult[]> {
  const { data: items, error } = await supabase
    .from('incoming_items')
    .select('id')
    .in('processing_state', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  if (!items || items.length === 0) return []

  return classifyBatchWithPath(supabase, items.map(i => i.id))
}
