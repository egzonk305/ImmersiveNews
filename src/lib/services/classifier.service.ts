import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  Json,
  ClassifierSettings,
  IncomingItem,
  TopicWithPath,
} from '@/lib/types/database.types'
import { generate, OllamaError } from '@/lib/services/ollama.client'
import { enrichItem } from '@/lib/services/enrichment.service'
import { buildClassifierPrompt } from '@/lib/prompts/classifier-prompt'
import {
  compactResponseSchema,
  type ClassifierCandidate,
} from '@/lib/validators/classifier.schema'

export interface ClassifyResult {
  item_id: string
  status: 'success' | 'failed' | 'parse_error'
  candidates_saved: number
  primary_topic_id: string | null
  primary_confidence: number | null
  auto_accepted: boolean
  error?: string
  run_id: string
}

export async function getSettings(
  supabase: SupabaseClient<Database>
): Promise<ClassifierSettings> {
  const { data, error } = await supabase
    .from('classifier_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error(`Classifier-Settings nicht gefunden: ${error?.message}`)
  }
  return data
}

export async function getAllowedTopics(
  supabase: SupabaseClient<Database>
): Promise<TopicWithPath[]> {
  const { data, error } = await supabase
    .from('topics_with_path')
    .select('*')
    .order('full_path', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

function tryParseJson(text: string): unknown | null {
  const full = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*/g, '')
    .trim()

  try {
    return JSON.parse(full)
  } catch {
    // Abgeschnittenes candidates-Array: letzten unvollständigen Eintrag abschneiden, schließen
    const arrayStart = full.indexOf('{"candidates":[')
    if (arrayStart !== -1) {
      const inner = full.slice(arrayStart + '{"candidates":['.length)
      // Alle vollständigen {...}-Objekte extrahieren
      const objects: string[] = []
      let depth = 0, start = -1
      for (let i = 0; i < inner.length; i++) {
        if (inner[i] === '{') { if (depth === 0) start = i; depth++ }
        else if (inner[i] === '}') {
          depth--
          if (depth === 0 && start !== -1) { objects.push(inner.slice(start, i + 1)); start = -1 }
        }
      }
      if (objects.length > 0) {
        try { return JSON.parse(`{"candidates":[${objects.join(',')}]}`) } catch { /* weiter */ }
      }
    }
    // Letzter Fallback: erstes vollständiges JSON-Objekt
    const m = full.match(/\{[\s\S]*\}/)
    if (m) try { return JSON.parse(m[0]) } catch { /* weiter */ }
    return null
  }
}

interface StageResult {
  candidates: ClassifierCandidate[]
  prompt: string
  rawResponse: string
  error: string | null
}

async function runStage(
  settings: ClassifierSettings,
  itemForPrompt: { title: string; description: string | null; content: string | null },
  topics: TopicWithPath[],
  maxCandidates: number,
  maxDepth: number
): Promise<StageResult> {
  const flat = topics.map(t => ({ id: t.id, full_path: t.full_path, level: t.level }))
  const { prompt, indexMap } = buildClassifierPrompt({
    item: itemForPrompt,
    allowedTopics: flat,
    maxCandidates,
    maxDepth,
  })

  let rawResponse = ''
  try {
    const result = await generate({
      baseUrl: settings.ollama_base_url,
      model: settings.model_name,
      prompt,
      temperature: settings.temperature,
      numCtx: settings.num_ctx,
      numPredict: settings.num_predict,
      timeoutMs: settings.timeout_ms,
    })
    rawResponse = result.response
    const parsed = tryParseJson(rawResponse)
    if (!parsed) return { candidates: [], prompt, rawResponse, error: 'JSON parse fehlgeschlagen' }

    const validated = compactResponseSchema.safeParse(parsed)
    if (!validated.success) {
      return { candidates: [], prompt, rawResponse, error: `Schema: ${validated.error.errors[0].message}` }
    }

    const candidates = validated.data.candidates
      .map(c => ({
        topic_id: indexMap[c.n] ?? '',
        confidence: c.confidence,
        is_primary: c.is_primary,
        reason: c.reason ?? null,
      }))
      .filter(c => !!c.topic_id)

    return { candidates, prompt, rawResponse, error: null }
  } catch (err) {
    return {
      candidates: [],
      prompt,
      rawResponse,
      error: err instanceof OllamaError ? err.message : err instanceof Error ? err.message : String(err),
    }
  }
}

export async function classifyItem(
  supabase: SupabaseClient<Database>,
  itemId: string
): Promise<ClassifyResult> {
  const settings = await getSettings(supabase)

  const { data: item, error: itemError } = await supabase
    .from('incoming_items')
    .select('*')
    .eq('id', itemId)
    .single<IncomingItem>()
  if (itemError || !item) {
    throw new Error(`Item nicht gefunden: ${itemError?.message}`)
  }

  await supabase
    .from('incoming_items')
    .update({ processing_state: 'processing', processing_error: null })
    .eq('id', itemId)

  const allowed = await getAllowedTopics(supabase)

  // Enrichment: Volltext holen wenn global aktiviert und Item hat URL
  let enrichedContent: string | null = item.enriched_content ?? null
  if (
    settings.enrichment_enabled_global &&
    item.source_url &&
    item.enrichment_status !== 'success' &&
    (item.description?.length ?? 0) < settings.enrichment_min_description_chars
  ) {
    try {
      enrichedContent = await enrichItem(supabase, itemId, item.source_url, settings)
    } catch {
      // Klassifizierung trotzdem fortsetzen
    }
  }

  const itemForPrompt = {
    title: item.title,
    description: item.description,
    content: enrichedContent ?? item.content,
  }

  const startTs = Date.now()
  let runStatus: 'success' | 'failed' | 'parse_error' = 'failed'
  let parsedJson: unknown = null
  let errorMessage: string | null = null
  let combinedPrompt = ''
  let combinedRaw = ''

  // --- Stufe 1: Root-Topic ermitteln ---
  const rootTopics = allowed.filter(t => t.level === 1)
  const stage1 = await runStage(settings, itemForPrompt, rootTopics, 1, 1)
  combinedPrompt = `[Stufe 1]\n${stage1.prompt}`
  combinedRaw = `[Stufe 1]\n${stage1.rawResponse}`

  let stage2Topics = allowed // Fallback: alle Topics
  if (stage1.error === null && stage1.candidates.length > 0) {
    const rootId = stage1.candidates[0].topic_id
    const root = allowed.find(t => t.id === rootId)
    if (root) {
      // Root selbst + alle Topics die unter diesem Root liegen
      stage2Topics = allowed.filter(
        t => t.id === rootId || t.path_array[0] === root.name
      )
    }
  }

  // --- Stufe 2: Sub-Topics des Root-Topics ---
  const stage2 = await runStage(settings, itemForPrompt, stage2Topics, settings.max_candidates, settings.max_depth)
  combinedPrompt += `\n\n[Stufe 2]\n${stage2.prompt}`
  combinedRaw += `\n\n[Stufe 2]\n${stage2.rawResponse}`

  if (stage2.error !== null) {
    runStatus = 'parse_error'
    errorMessage = `Stufe 2: ${stage2.error}`
  } else if (stage2.candidates.length === 0 && stage1.candidates.length > 0) {
    // Stufe 2 lieferte nichts — Root-Kandidat als Fallback
    parsedJson = { candidates: stage1.candidates }
    runStatus = 'success'
  } else if (stage2.candidates.length > 0) {
    parsedJson = { candidates: stage2.candidates }
    runStatus = 'success'
  } else {
    errorMessage = stage1.error ?? 'Keine Kandidaten gefunden'
    runStatus = 'parse_error'
  }

  const durationMs = Date.now() - startTs

  // run aufzeichnen
  const { data: runData } = await supabase
    .from('classification_runs')
    .insert({
      incoming_item_id: itemId,
      model: settings.model_name,
      status: runStatus,
      duration_ms: durationMs,
      prompt: combinedPrompt,
      raw_response: combinedRaw || null,
      parsed_response: (parsedJson as Json) ?? null,
      error_message: errorMessage,
    })
    .select('id')
    .single()

  if (runStatus !== 'success') {
    await supabase
      .from('incoming_items')
      .update({
        processing_state: 'failed',
        processing_error: errorMessage,
      })
      .eq('id', itemId)

    return {
      item_id: itemId,
      status: runStatus,
      candidates_saved: 0,
      primary_topic_id: null,
      primary_confidence: null,
      auto_accepted: false,
      error: errorMessage ?? undefined,
      run_id: runData?.id ?? '',
    }
  }

  // Kandidaten validieren: alle topic_ids müssen in DB existieren
  const allowedIds = new Set(allowed.map(t => t.id))
  const mappedCandidates = (parsedJson as { candidates: ClassifierCandidate[] }).candidates
  const validCandidates = mappedCandidates.filter(c => allowedIds.has(c.topic_id))

  if (validCandidates.length === 0) {
    await supabase
      .from('incoming_items')
      .update({
        processing_state: 'failed',
        processing_error: 'KI lieferte nur unbekannte topic_ids',
      })
      .eq('id', itemId)
    return {
      item_id: itemId,
      status: 'failed',
      candidates_saved: 0,
      primary_topic_id: null,
      primary_confidence: null,
      auto_accepted: false,
      error: 'Keine gültigen topic_ids',
      run_id: runData?.id ?? '',
    }
  }

  // Sortiere nach is_primary desc, confidence desc; stelle sicher dass genau einer primary ist
  validCandidates.sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return (b.confidence ?? 0) - (a.confidence ?? 0)
  })
  let primaryAssigned = false
  const finalCandidates: ClassifierCandidate[] = validCandidates
    .slice(0, settings.max_candidates)
    .map((c, i) => {
      const is_primary = !primaryAssigned && (c.is_primary || i === 0)
      if (is_primary) primaryAssigned = true
      return { ...c, is_primary }
    })

  // Bestehende llm-Kandidaten desselben Items entfernen, dann neu schreiben
  await supabase
    .from('incoming_item_topics')
    .delete()
    .eq('incoming_item_id', itemId)
    .eq('source', 'llm')

  const rows = finalCandidates.map((c, i) => ({
    incoming_item_id: itemId,
    topic_id: c.topic_id,
    rank: i + 1,
    confidence: c.confidence,
    is_primary: c.is_primary,
    reason: c.reason ?? null,
    source: 'llm' as const,
    status: 'suggested' as const,
  }))

  const { error: insErr } = await supabase.from('incoming_item_topics').insert(rows)
  if (insErr) {
    await supabase
      .from('incoming_items')
      .update({
        processing_state: 'failed',
        processing_error: `Insert-Kandidaten: ${insErr.message}`,
      })
      .eq('id', itemId)
    return {
      item_id: itemId,
      status: 'failed',
      candidates_saved: 0,
      primary_topic_id: null,
      primary_confidence: null,
      auto_accepted: false,
      error: insErr.message,
      run_id: runData?.id ?? '',
    }
  }

  const primary = finalCandidates.find(c => c.is_primary)!

  // Auto-Accept
  let autoAccepted = false
  if (
    settings.auto_accept_enabled &&
    primary.confidence >= settings.confidence_threshold
  ) {
    await supabase
      .from('incoming_item_topics')
      .update({ status: 'confirmed' })
      .eq('incoming_item_id', itemId)
      .eq('topic_id', primary.topic_id)

    await supabase
      .from('incoming_items')
      .update({
        processing_state: 'done',
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        target_topic_id: primary.topic_id,
      })
      .eq('id', itemId)
    autoAccepted = true
  } else {
    await supabase
      .from('incoming_items')
      .update({ processing_state: 'classified', processing_error: null })
      .eq('id', itemId)
  }

  return {
    item_id: itemId,
    status: 'success',
    candidates_saved: rows.length,
    primary_topic_id: primary.topic_id,
    primary_confidence: primary.confidence,
    auto_accepted: autoAccepted,
    run_id: runData?.id ?? '',
  }
}

export async function classifyBatch(
  supabase: SupabaseClient<Database>,
  ids: string[]
): Promise<ClassifyResult[]> {
  const results: ClassifyResult[] = []
  for (const id of ids) {
    try {
      results.push(await classifyItem(supabase, id))
    } catch (err) {
      results.push({
        item_id: id,
        status: 'failed',
        candidates_saved: 0,
        primary_topic_id: null,
        primary_confidence: null,
        auto_accepted: false,
        error: err instanceof Error ? err.message : String(err),
        run_id: '',
      })
    }
  }
  return results
}

export async function classifyAllPending(
  supabase: SupabaseClient<Database>,
  limit = 25
): Promise<ClassifyResult[]> {
  const { data: items, error } = await supabase
    .from('incoming_items')
    .select('id')
    .eq('processing_state', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)
  if (!items || items.length === 0) return []

  return classifyBatch(supabase, items.map(i => i.id))
}

export async function quickRootSort(
  supabase: SupabaseClient<Database>,
  itemIds: string[],
  feedRootTopicId: string | null
): Promise<void> {
  if (itemIds.length === 0) return

  // Fast path: feed hat bereits ein Root-Thema konfiguriert
  if (feedRootTopicId) {
    await supabase
      .from('incoming_items')
      .update({ target_topic_id: feedRootTopicId })
      .in('id', itemIds)
    return
  }

  // LLM-Pfad: schnelle Stage-1-Klassifikation nur auf Root-Themen
  let settings
  try {
    settings = await getSettings(supabase)
  } catch {
    return
  }

  const rootTopics = (await getAllowedTopics(supabase)).filter(t => t.level === 1)
  if (rootTopics.length === 0) return

  const { data: items } = await supabase
    .from('incoming_items')
    .select('id, title, description, content')
    .in('id', itemIds)
  if (!items || items.length === 0) return

  const concurrency = 3
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    await Promise.allSettled(
      chunk.map(async item => {
        try {
          const result = await runStage(
            settings,
            { title: item.title, description: item.description ?? null, content: (item as { content?: string | null }).content ?? null },
            rootTopics,
            1,
            1
          )
          if (result.error === null && result.candidates.length > 0) {
            await supabase
              .from('incoming_items')
              .update({ target_topic_id: result.candidates[0].topic_id })
              .eq('id', item.id)
          }
        } catch {
          // best-effort, Fehler unterdrücken
        }
      })
    )
  }
}

export async function classifyParallel(
  supabase: SupabaseClient<Database>,
  itemIds: string[],
  concurrency = 3,
  onProgress?: (progress: { current: number; total: number; success: number; failed: number }) => void,
  signal?: AbortSignal
): Promise<{ success: number; failed: number; results: ClassifyResult[] }> {
  let current = 0
  let success = 0
  let failed = 0
  const results: ClassifyResult[] = []
  const safeConcurrency = Math.min(Math.max(concurrency, 1), 10)

  for (let i = 0; i < itemIds.length; i += safeConcurrency) {
    if (signal?.aborted) break

    const batch = itemIds.slice(i, i + safeConcurrency)
    const batchResults = await Promise.allSettled(
      batch.map(id => classifyItem(supabase, id))
    )

    for (let j = 0; j < batchResults.length; j++) {
      current++
      const result = batchResults[j]

      if (result.status === 'fulfilled') {
        results.push(result.value)
        if (result.value.status === 'success') success++
        else failed++
      } else {
        failed++
        results.push({
          item_id: batch[j],
          status: 'failed',
          candidates_saved: 0,
          primary_topic_id: null,
          primary_confidence: null,
          auto_accepted: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          run_id: '',
        })
      }

      onProgress?.({ current, total: itemIds.length, success, failed })
    }
  }

  return { success, failed, results }
}
