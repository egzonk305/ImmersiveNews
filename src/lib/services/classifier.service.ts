import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  ClassifierSettings,
  IncomingItem,
  TopicWithPath,
} from '@/lib/types/database.types'
import { generate, OllamaError } from '@/lib/services/ollama.client'
import { buildClassifierPrompt } from '@/lib/prompts/classifier-prompt'
import {
  classifierResponseSchema,
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
  try {
    return JSON.parse(text)
  } catch {
    // versuche, JSON aus Markdown-Block oder Text zu extrahieren
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
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
  // Nur Topics, die mindestens Level 2 erreichen (Roots sind selten richtig als final)
  // Aber wir lassen alle Topics zu — die KI entscheidet selbst.
  const allowedFlat = allowed.map(t => ({
    id: t.id,
    full_path: t.full_path,
    level: t.level,
  }))

  const prompt = buildClassifierPrompt({
    item: { title: item.title, description: item.description, content: item.content },
    allowedTopics: allowedFlat,
    maxCandidates: settings.max_candidates,
    maxDepth: settings.max_depth,
  })

  const startTs = Date.now()
  let rawResponse = ''
  let runStatus: 'success' | 'failed' | 'parse_error' = 'failed'
  let parsedJson: unknown = null
  let errorMessage: string | null = null

  try {
    const result = await generate({
      baseUrl: settings.ollama_base_url,
      model: settings.model_name,
      prompt,
      format: 'json',
      temperature: 0.2,
    })
    rawResponse = result.response
    parsedJson = tryParseJson(result.response)
    if (parsedJson === null) {
      runStatus = 'parse_error'
      errorMessage = 'Antwort konnte nicht als JSON geparst werden'
    } else {
      const validated = classifierResponseSchema.safeParse(parsedJson)
      if (!validated.success) {
        runStatus = 'parse_error'
        errorMessage = `Schema-Validierung fehlgeschlagen: ${validated.error.errors[0].message}`
      } else {
        runStatus = 'success'
      }
    }
  } catch (err) {
    runStatus = 'failed'
    errorMessage =
      err instanceof OllamaError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err)
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
      prompt,
      raw_response: rawResponse || null,
      parsed_response: (parsedJson as Record<string, unknown>) ?? null,
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
  const validated = classifierResponseSchema.parse(parsedJson)
  const allowedIds = new Set(allowed.map(t => t.id))
  const validCandidates = validated.candidates.filter(c => allowedIds.has(c.topic_id))

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
