import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  IncomingItem,
  Json,
  NewsStory,
  RssFeed,
  Topic,
  TopicPath,
  TopicWithPath,
} from '@/lib/types/database.types'
import { buildDynamicNewsPathPrompt } from '@/lib/prompts/dynamic-news-path-prompt'
import { generate } from '@/lib/services/ollama.client'
import { getSettings } from '@/lib/services/classifier.service'
import {
  dynamicNewsPathResultSchema,
  type DynamicNewsPathResult,
} from '@/lib/validators/classifier.schema'

export interface RelevantTopic {
  id: string
  label: string
  canonical_label: string
  type: string | null
  path: string
}

export interface RelevantPath {
  path_id: string
  path: string[]
  last_used_at: string | null
  article_count: number
}

export interface RelevantStory {
  id: string
  story_key: string
  title: string
  current_summary: string | null
  latest_item_title: string | null
  updated_at: string
}

export interface DynamicClassificationResult {
  itemId: string
  status: 'success' | 'failed' | 'parse_error' | 'skipped'
  skipped: boolean
  skipReason?: string
  rootTopic?: string
  storyId?: string | null
  primaryTopicId?: string | null
  paths?: string[][]
  error?: string
  runId?: string
  durationMs: number
}

export interface BatchSummary {
  processed: number
  succeeded: number
  failed: number
  skipped: number
  elapsedMs: number
  avgMsPerItem: number
}

export interface ProcessPendingOptions {
  limit?: number
  force?: boolean
  concurrency?: number
  includeFailed?: boolean
}

const ROOT_TOPICS = ['Natur', 'Politik', 'Sport', 'Technik'] as const
const DEFAULT_MAX_EXCERPT_CHARS = 2000
const MAX_RAW_LOG_CHARS = 12000
const MAX_PROMPT_LOG_CHARS = 16000

type RootTopic = typeof ROOT_TOPICS[number]
type Supabase = SupabaseClient<Database>

function envInt(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function envFloat(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function truncate(text: string | null | undefined, max: number) {
  if (!text) return null
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function stripBoilerplate(text: string | null | undefined) {
  if (!text) return null
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\b(Cookies?|Cookie-Einstellungen|Datenschutz|Newsletter|Anzeige|Werbung|Navigation|Zum Inhalt springen)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildContentHash(input: {
  title: string
  description?: string | null
  content?: string | null
  source_url?: string | null
}) {
  const base = [
    input.title,
    input.description ?? '',
    stripBoilerplate(input.content)?.slice(0, 4000) ?? '',
    input.source_url ?? '',
  ].join('\n')
  return createHash('sha256').update(base).digest('hex')
}

export function createTopicSlug(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function canonicalizeTopicLabel(label: string, context?: string[]) {
  const cleaned = label
    .replace(/[“”„]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  const lower = cleaned.toLowerCase()
  const contextText = (context ?? []).join(' ').toLowerCase()
  const footballContext = /fußball|fussball|sport|league|liga|meisterschaft|verein/.test(contextText)

  if (footballContext) {
    if (['ucl', 'uefa champions league', 'championsleague'].includes(lower)) return 'Champions League'
    if (['man city', 'manchester city fc'].includes(lower)) return 'Manchester City'
    if (['bayern münchen', 'fc bayern', 'bayern munich'].includes(lower)) return 'FC Bayern München'
  }

  if (lower === 'premierleague') return 'Premier League'
  if (lower === 'open ai') return 'OpenAI'
  return cleaned
}

function inferTopicType(segment: string, path: string[]) {
  const lower = segment.toLowerCase()
  const pathText = path.join(' ').toLowerCase()
  if (path.length === 1) return 'root'
  if (/bundesregierung|regierung|partei|ministerium|senat|parlament/.test(lower)) return 'political_entity'
  if (/league|liga|meisterschaft|champions league|wettbewerb|pokal/.test(lower)) return 'league'
  if (/city|fc |verein|everton|arsenal|bayern|psg/.test(lower) && /fußball|fussball|sport/.test(pathText)) return 'club'
  if (/ki|künstliche intelligenz|modell|openai|gpt|software|technologie/.test(lower)) return 'technology'
  if (/deutschland|england|bayern|usa|europa|international/.test(lower)) return 'place'
  if (path.length >= 5) return 'story'
  return path.length === 2 ? 'category' : 'topic'
}

function extractTokens(item: IncomingItem, max = 14) {
  const text = `${item.title} ${item.description ?? ''} ${stripBoilerplate(item.content)?.slice(0, 1000) ?? ''}`
  const stop = new Set([
    'und', 'oder', 'der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einer', 'mit',
    'gegen', 'auf', 'aus', 'von', 'im', 'in', 'am', 'an', 'für', 'als', 'ist', 'sich',
  ])
  const tokens = text
    .split(/[^\p{L}\p{N}]+/u)
    .map(t => t.trim())
    .filter(t => t.length >= 4 && !stop.has(t.toLowerCase()))

  const counts = new Map<string, number>()
  for (const token of tokens) {
    const key = token.toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([token]) => token)
}

function scoreText(text: string, tokens: string[]) {
  const lower = text.toLowerCase()
  return tokens.reduce((score, token) => score + (lower.includes(token.toLowerCase()) ? 1 : 0), 0)
}

function extractJson(text: string) {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*/g, '')
    .trim()
  try {
    return JSON.parse(cleaned) as unknown
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as unknown
    } catch {
      return null
    }
  }
}

function normalizePath(path: string[], rootTopic: RootTopic) {
  const result = path
    .map(segment => canonicalizeTopicLabel(segment, path))
    .filter(Boolean)
    .slice(0, 8)

  if (result[0] !== rootTopic) result.unshift(rootTopic)
  return result.slice(0, 8)
}

async function getDynamicSettings(supabase: Supabase) {
  try {
    const settings = await getSettings(supabase)
    return {
      baseUrl: settings.ollama_base_url || process.env.NEWS_LLM_BASE_URL || 'http://localhost:11434',
      model: process.env.NEWS_LLM_MODEL || settings.model_name || 'gemma4:latest',
      temperature: envFloat('NEWS_LLM_TEMPERATURE', Number(settings.temperature ?? 0.1)),
      numCtx: settings.num_ctx ?? 8192,
      numPredict: envInt('NEWS_LLM_NUM_PREDICT', Math.min(settings.num_predict ?? 1000, 900)),
      timeoutMs: settings.timeout_ms ?? 360000,
      enrichmentEnabled: settings.enrichment_enabled_global,
      enrichmentMinDescriptionChars: settings.enrichment_min_description_chars,
    }
  } catch {
    return {
      baseUrl: process.env.NEWS_LLM_BASE_URL || 'http://localhost:11434',
      model: process.env.NEWS_LLM_MODEL || 'gemma4:latest',
      temperature: envFloat('NEWS_LLM_TEMPERATURE', 0.1),
      numCtx: 8192,
      numPredict: envInt('NEWS_LLM_NUM_PREDICT', 900),
      timeoutMs: 360000,
      enrichmentEnabled: false,
      enrichmentMinDescriptionChars: 200,
    }
  }
}

async function getFeed(supabase: Supabase, item: IncomingItem): Promise<RssFeed | null> {
  if (!item.feed_id) return null
  const { data } = await supabase
    .from('rss_feeds')
    .select('*')
    .eq('id', item.feed_id)
    .maybeSingle()
  return data ?? null
}

export async function getRelevantTopicContextForItem(supabase: Supabase, item: IncomingItem) {
  const maxTopics = envInt('NEWS_LLM_MAX_RELEVANT_TOPICS', 10)
  const maxPaths = envInt('NEWS_LLM_MAX_RELEVANT_PATHS', 8)
  const maxStories = envInt('NEWS_LLM_MAX_SIMILAR_STORIES', 5)
  const tokens = extractTokens(item)
  const slugTokens = tokens.map(createTopicSlug).filter(Boolean)

  let topicQuery = supabase
    .from('topics_with_path')
    .select('*')
    .eq('topic_status', 'active')
    .limit(200)

  const filters = [
    ...tokens.flatMap(token => [`name.ilike.%${token}%`, `canonical_name.ilike.%${token}%`]),
    ...slugTokens.map(token => `slug.ilike.%${token}%`),
  ].slice(0, 40)

  if (filters.length > 0) {
    topicQuery = topicQuery.or(filters.join(','))
  }

  const { data: topicRows } = await topicQuery
  const scoredTopics = (topicRows ?? [])
    .map(topic => ({
      topic,
      score: scoreText(`${topic.name} ${topic.canonical_name ?? ''} ${topic.full_path}`, tokens),
    }))
    .filter(entry => entry.score > 0 || entry.topic.level === 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTopics)

  const existing_relevant_topics: RelevantTopic[] = scoredTopics.map(({ topic }) => ({
    id: topic.id,
    label: topic.name,
    canonical_label: topic.canonical_name ?? topic.name,
    type: topic.topic_type ?? null,
    path: topic.full_path,
  }))

  const pathIds = scoredTopics.map(({ topic }) => topic.id)
  let existing_relevant_paths: RelevantPath[] = []
  if (pathIds.length > 0) {
    const { data: paths } = await supabase
      .from('topic_paths_view')
      .select('*')
      .in('topic_id', pathIds)
      .limit(maxPaths)

    existing_relevant_paths = (paths ?? []).map((path: TopicPath) => ({
      path_id: path.topic_id,
      path: path.path_names,
      last_used_at: null,
      article_count: 0,
    }))
  }

  let storyQuery = supabase
    .from('news_stories')
    .select('*, latest:incoming_items!news_stories_latest_item_id_fkey(title)')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (filters.length > 0) {
    storyQuery = storyQuery.or(tokens.slice(0, 8).flatMap(token => [
      `story_key.ilike.%${createTopicSlug(token)}%`,
      `title.ilike.%${token}%`,
      `current_summary.ilike.%${token}%`,
    ]).join(','))
  }

  const { data: stories } = await storyQuery
  const existing_similar_stories: RelevantStory[] = (stories ?? [])
    .map(story => ({
      story: story as unknown as NewsStory & { latest?: { title: string | null } | { title: string | null }[] | null },
      score: scoreText(`${story.story_key} ${story.title} ${story.current_summary ?? ''}`, tokens),
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxStories)
    .map(({ story }) => ({
      id: story.id,
      story_key: story.story_key,
      title: story.title,
      current_summary: story.current_summary,
      latest_item_title: Array.isArray(story.latest)
        ? story.latest[0]?.title ?? null
        : story.latest?.title ?? null,
      updated_at: story.updated_at,
    }))

  return {
    existing_relevant_topics,
    existing_relevant_paths,
    existing_similar_stories,
  }
}

async function findRootTopic(supabase: Supabase, rootTopic: RootTopic) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .is('parent_id', null)
    .eq('name', rootTopic)
    .single()
  if (error || !data) throw new Error(`Root-Topic ${rootTopic} nicht gefunden`)
  return data
}

export async function findExistingTopicByCanonicalLabel(
  supabase: Supabase,
  parentId: string | null,
  label: string
) {
  const canonical = canonicalizeTopicLabel(label)
  const slug = createTopicSlug(canonical)
  const query = supabase
    .from('topics')
    .select('*')
    .eq('topic_status', 'active')

  const withParent = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null)
  const { data, error } = await withParent
    .or(`slug.eq.${slug},canonical_name.ilike.${canonical},name.ilike.${canonical}`)
    .limit(2)

  if (error) throw new Error(error.message)
  if ((data ?? []).length === 1) return data![0]
  return data?.find(topic => topic.slug === slug) ?? null
}

async function resolveOrCreateTopicSegment(
  supabase: Supabase,
  parentTopic: Topic,
  segmentLabel: string,
  rootTopic: RootTopic,
  pathSoFar: string[],
  metadata: Json
) {
  const canonical = canonicalizeTopicLabel(segmentLabel, pathSoFar)
  const existing = await findExistingTopicByCanonicalLabel(supabase, parentTopic.id, canonical)
  const now = new Date().toISOString()

  if (existing) {
    await supabase
      .from('topics')
      .update({
        usage_count: (existing.usage_count ?? 0) + 1,
        last_seen_at: now,
      })
      .eq('id', existing.id)
    return existing
  }

  const insert = {
    name: canonical,
    canonical_name: canonical,
    slug: createTopicSlug(canonical),
    parent_id: parentTopic.id,
    level: parentTopic.level + 1,
    topic_status: 'active' as const,
    proposed_by_llm: false,
    auto_created: true,
    last_seen_at: now,
    usage_count: 1,
    source: 'dynamic_news_path',
    topic_type: inferTopicType(canonical, [...pathSoFar, canonical]),
    metadata: {
      ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}),
      root_topic: rootTopic,
    } as Json,
  }

  const { data, error } = await supabase
    .from('topics')
    .insert(insert)
    .select('*')
    .single()

  if (!error && data) return data

  const raced = await findExistingTopicByCanonicalLabel(supabase, parentTopic.id, canonical)
  if (raced) return raced
  throw new Error(`Topic-Segment konnte nicht erstellt werden: ${error?.message ?? canonical}`)
}

async function upsertStory(
  supabase: Supabase,
  item: IncomingItem,
  result: DynamicNewsPathResult
) {
  const storyKey = createTopicSlug(result.story.story_key || result.story.title)
  let story: NewsStory | null = null

  if (result.story.existing_story_id) {
    const { data } = await supabase
      .from('news_stories')
      .select('*')
      .eq('id', result.story.existing_story_id)
      .maybeSingle()
    story = data ?? null
  }

  if (!story) {
    const { data } = await supabase
      .from('news_stories')
      .select('*')
      .eq('story_key', storyKey)
      .maybeSingle()
    story = data ?? null
  }

  const summary = result.story.new_current_summary || result.summary_short
  if (!story) {
    const { data, error } = await supabase
      .from('news_stories')
      .insert({
        story_key: storyKey,
        root_topic: result.root_topic,
        title: result.story.title || result.headline,
        current_summary: summary,
      })
      .select('*')
      .single()
    if (error || !data) throw new Error(`Story konnte nicht erstellt werden: ${error?.message}`)
    story = data
  } else {
    const { data, error } = await supabase
      .from('news_stories')
      .update({
        title: result.story.title || story.title,
        current_summary: summary || story.current_summary,
        root_topic: result.root_topic,
      })
      .eq('id', story.id)
      .select('*')
      .single()
    if (error || !data) throw new Error(`Story konnte nicht aktualisiert werden: ${error?.message}`)
    story = data
  }

  await supabase
    .from('story_items')
    .upsert({
      story_id: story.id,
      incoming_item_id: item.id,
      relation: result.story.updates_existing_story ? 'update' : 'related',
    }, { onConflict: 'story_id,incoming_item_id' })

  let shouldReplaceLatest = result.story.should_replace_latest_item || !story.latest_item_id
  if (!shouldReplaceLatest && story.latest_item_id && item.published_at) {
    const { data: latest } = await supabase
      .from('incoming_items')
      .select('published_at, created_at')
      .eq('id', story.latest_item_id)
      .maybeSingle()
    const currentTs = new Date(item.published_at).getTime()
    const latestTs = new Date(latest?.published_at ?? latest?.created_at ?? 0).getTime()
    shouldReplaceLatest = currentTs > latestTs
  }

  if (shouldReplaceLatest) {
    await supabase
      .from('incoming_items')
      .update({ latest_in_story: false })
      .eq('story_id', story.id)

    const { data, error } = await supabase
      .from('news_stories')
      .update({ latest_item_id: item.id })
      .eq('id', story.id)
      .select('*')
      .single()
    if (error || !data) throw new Error(`Latest-Story konnte nicht gesetzt werden: ${error?.message}`)
    story = data
  }

  return { story, latest: shouldReplaceLatest, storyKey }
}

export async function applyNewsPathResult(
  supabase: Supabase,
  item: IncomingItem,
  result: DynamicNewsPathResult
) {
  const root = await findRootTopic(supabase, result.root_topic)
  const linkedTopics: { topic: Topic; confidence: number; isPrimary: boolean; rank: number }[] = []
  const normalizedPaths = result.paths.map(entry => ({
    path: normalizePath(entry.path, result.root_topic),
    confidence: entry.confidence,
  }))

  for (let i = 0; i < normalizedPaths.length; i++) {
    const entry = normalizedPaths[i]
    let parent = root
    const segments = entry.path.slice(1, -1).slice(0, 7)
    const pathSoFar = [root.name]

    for (const segment of segments) {
      parent = await resolveOrCreateTopicSegment(
        supabase,
        parent,
        segment,
        result.root_topic,
        pathSoFar,
        { source_item_id: item.id } as Json
      )
      pathSoFar.push(parent.name)
    }

    linkedTopics.push({
      topic: parent,
      confidence: entry.confidence,
      isPrimary: i === 0,
      rank: i + 1,
    })
  }

  await supabase
    .from('incoming_item_topics')
    .delete()
    .eq('incoming_item_id', item.id)
    .eq('source', 'llm')

  const deduped = linkedTopics.filter(
    (link, idx, arr) => arr.findIndex(l => l.topic.id === link.topic.id) === idx
  )

  if (deduped.length > 0) {
    const { error } = await supabase
      .from('incoming_item_topics')
      .insert(deduped.map(link => ({
        incoming_item_id: item.id,
        topic_id: link.topic.id,
        rank: link.rank,
        confidence: link.confidence,
        is_primary: link.isPrimary,
        reason: `Dynamic path: ${normalizedPaths[link.rank - 1]?.path.join(' > ')}`,
        source: 'llm' as const,
        status: 'suggested' as const,
      })))
    if (error) throw new Error(`incoming_item_topics: ${error.message}`)
  }

  const { story, latest, storyKey } = await upsertStory(supabase, item, result)
  const primaryTopicId = linkedTopics[0]?.topic.id ?? root.id
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('incoming_items')
    .update({
      ai_headline: result.headline,
      ai_description: result.description,
      ai_summary_short: result.summary_short,
      ai_entities: {
        ...result.entities,
        merge_suggestions: result.merge_suggestions,
      } as unknown as Json,
      ai_paths: normalizedPaths.map(path => path.path) as unknown as Json,
      story_key: storyKey,
      story_id: story.id,
      latest_in_story: latest,
      target_topic_id: primaryTopicId,
      processed_at: now,
      processing_state: 'classified',
      processing_error: null,
      content_hash: buildContentHash(item),
    })
    .eq('id', item.id)

  if (updateError) throw new Error(`incoming_items update: ${updateError.message}`)

  return {
    storyId: story.id,
    latest,
    primaryTopicId,
    paths: normalizedPaths.map(path => path.path),
  }
}

async function shouldSkipItem(supabase: Supabase, item: IncomingItem, force: boolean) {
  if (force) return null
  if (item.processing_state === 'done') return 'processing_state=done'
  if (item.ai_paths && item.ai_summary_short) return 'ai_paths und ai_summary_short vorhanden'

  const nextHash = buildContentHash(item)
  if (item.content_hash && item.content_hash === nextHash && item.processed_at) {
    return 'content_hash unveraendert'
  }

  if (item.source_url) {
    const { data } = await supabase
      .from('incoming_items')
      .select('id')
      .eq('source_url', item.source_url)
      .not('processed_at', 'is', null)
      .neq('id', item.id)
      .limit(1)
    if ((data ?? []).length > 0) return 'source_url bereits verarbeitet'
  }

  return null
}

async function logRun(
  supabase: Supabase,
  input: {
    itemId: string
    model: string
    status: 'success' | 'failed' | 'parse_error'
    durationMs: number
    prompt: string
    rawResponse: string | null
    parsedResponse: unknown
    errorMessage: string | null
  }
) {
  const { data } = await supabase
    .from('classification_runs')
    .insert({
      incoming_item_id: input.itemId,
      model: input.model,
      status: input.status,
      duration_ms: input.durationMs,
      prompt: truncate(input.prompt, MAX_PROMPT_LOG_CHARS),
      raw_response: truncate(input.rawResponse, MAX_RAW_LOG_CHARS),
      parsed_response: input.parsedResponse as Json,
      error_message: input.errorMessage,
    })
    .select('id')
    .single()
  return data?.id ?? ''
}

export async function classifyAndBuildPathsForItem(
  supabase: Supabase,
  itemId: string,
  options: { force?: boolean } = {}
): Promise<DynamicClassificationResult> {
  const started = Date.now()
  const { data: item, error } = await supabase
    .from('incoming_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (error || !item) throw new Error(`Item nicht gefunden: ${error?.message}`)

  const skipReason = await shouldSkipItem(supabase, item, options.force ?? false)
  if (skipReason) {
    return {
      itemId,
      status: 'skipped',
      skipped: true,
      skipReason,
      durationMs: Date.now() - started,
    }
  }

  await supabase
    .from('incoming_items')
    .update({ processing_state: 'processing', processing_error: null })
    .eq('id', itemId)

  const settings = await getDynamicSettings(supabase)
  const feed = await getFeed(supabase, item)
  const maxExcerptChars = envInt('NEWS_LLM_MAX_EXCERPT_CHARS', DEFAULT_MAX_EXCERPT_CHARS)
  const excerpt = truncate(stripBoilerplate(item.enriched_content ?? item.content), maxExcerptChars)
  const context = await getRelevantTopicContextForItem(supabase, item)
  const prompt = buildDynamicNewsPathPrompt({
    source: feed?.name ?? item.source_id,
    rss_category: null,
    url: item.source_url,
    published_at: item.published_at,
    title: item.title,
    description: item.description,
    text_excerpt: excerpt,
    ...context,
  })

  let rawResponse: string | null = null
  let parsed: unknown = null
  let validation = dynamicNewsPathResultSchema.safeParse(null)

  try {
    const generated = await generate({
      baseUrl: settings.baseUrl,
      model: settings.model,
      prompt,
      format: 'json',
      temperature: Math.min(Math.max(settings.temperature, 0), 0.2),
      numCtx: settings.numCtx,
      numPredict: Math.min(settings.numPredict, 900),
      timeoutMs: settings.timeoutMs,
    })
    rawResponse = generated.response
    parsed = extractJson(rawResponse)
    validation = dynamicNewsPathResultSchema.safeParse(parsed)

    if (!validation.success) {
      const repairPrompt = `Repariere diese Antwort zu exakt validem JSON fuer das angegebene Schema. Keine Erklaerung, kein Markdown.\n\nSchema: ${prompt.slice(prompt.indexOf('JSON-SCHEMA:'))}\n\nAntwort:\n${rawResponse}`
      const repaired = await generate({
        baseUrl: settings.baseUrl,
        model: settings.model,
        prompt: repairPrompt,
        format: 'json',
        temperature: 0,
        numCtx: settings.numCtx,
        numPredict: Math.min(settings.numPredict, 900),
        timeoutMs: settings.timeoutMs,
      })
      rawResponse = `${rawResponse}\n\n[repair]\n${repaired.response}`
      parsed = extractJson(repaired.response)
      validation = dynamicNewsPathResultSchema.safeParse(parsed)
    }

    if (!validation.success) {
      const durationMs = Date.now() - started
      const message = validation.error.errors[0]?.message ?? 'Ungueltiges JSON'
      const runId = await logRun(supabase, {
        itemId,
        model: settings.model,
        status: 'parse_error',
        durationMs,
        prompt,
        rawResponse,
        parsedResponse: parsed,
        errorMessage: message,
      })
      await supabase
        .from('incoming_items')
        .update({ processing_state: 'failed', processing_error: message })
        .eq('id', itemId)
      return { itemId, status: 'parse_error', skipped: false, error: message, runId, durationMs }
    }

    const applied = await applyNewsPathResult(supabase, item, validation.data)
    const durationMs = Date.now() - started
    const runId = await logRun(supabase, {
      itemId,
      model: settings.model,
      status: 'success',
      durationMs,
      prompt,
      rawResponse,
      parsedResponse: validation.data,
      errorMessage: null,
    })

    return {
      itemId,
      status: 'success',
      skipped: false,
      rootTopic: validation.data.root_topic,
      storyId: applied.storyId,
      primaryTopicId: applied.primaryTopicId,
      paths: applied.paths,
      runId,
      durationMs,
    }
  } catch (err) {
    const durationMs = Date.now() - started
    const message = err instanceof Error ? err.message : String(err)
    const runId = await logRun(supabase, {
      itemId,
      model: settings.model,
      status: 'failed',
      durationMs,
      prompt,
      rawResponse,
      parsedResponse: parsed,
      errorMessage: message,
    })
    await supabase
      .from('incoming_items')
      .update({ processing_state: 'failed', processing_error: message })
      .eq('id', itemId)
    return { itemId, status: 'failed', skipped: false, error: message, runId, durationMs }
  }
}

export async function processPendingItems(
  supabase: Supabase,
  options: ProcessPendingOptions = {}
): Promise<BatchSummary> {
  const started = Date.now()
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500)
  const force = options.force ?? false
  const concurrency = Math.min(
    Math.max(options.concurrency ?? envInt('NEWS_CLASSIFY_CONCURRENCY', 1), 1),
    2
  )

  let query = supabase
    .from('incoming_items')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(limit)

  query = options.includeFailed
    ? query.in('processing_state', ['pending', 'failed'])
    : query.eq('processing_state', 'pending')

  const { data: rows, error } = await query
  if (error) throw new Error(error.message)

  const ids = (rows ?? []).map(row => row.id)
  let processed = 0
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency)
    const results = await Promise.allSettled(
      chunk.map(id => classifyAndBuildPathsForItem(supabase, id, { force }))
    )

    for (const result of results) {
      processed++
      if (result.status === 'rejected') {
        failed++
        continue
      }
      if (result.value.status === 'skipped') skipped++
      else if (result.value.status === 'success') succeeded++
      else failed++
    }
  }

  const elapsedMs = Date.now() - started
  return {
    processed,
    succeeded,
    failed,
    skipped,
    elapsedMs,
    avgMsPerItem: processed > 0 ? Math.round(elapsedMs / processed) : 0,
  }
}

export async function createSmokeTestItem(supabase: Supabase) {
  const sourceUrl = 'smoke://premier-league-manchester-city-everton'
  const title = 'Premier League: Manchester City patzt gegen FC Everton im Kampf um die Meisterschaft'
  const description = 'Manchester City hat gegen Everton trotz turbulenter Schlussphase Punkte liegen lassen. Nun muss das Team von Pep Guardiola auf einen Ausrutscher von Arsenal hoffen. Der Trainer gibt sich trotzig.'
  const content = 'Hektik in der zweiten Halbzeit. Sie machten es dem Favoriten aus Manchester ueber weite Strecken schwer und belohnten sich nach dem Seitenwechsel mit drei Treffern zwischen der 68. und 81. Minute. Beim 1:1 profitierte der eingewechselte Thierno Barry von einem Fehlpass des City-Verteidigers Marc Guehi. Nur fuenf Minuten spaeter drehte Jake OBrien das Spiel, und Barry legte das dritte Tor nach. Die Londoner liegen drei Spiele vor Schluss mit 76 Punkten an der Tabellenspitze. Guardiolas Mannschaft hat zwar ein Spiel weniger absolviert, kann aus eigener Kraft aber nur noch auf zwei Punkte verkuerzen.'
  const contentHash = buildContentHash({ title, description, content, source_url: sourceUrl })

  const { data: existing } = await supabase
    .from('incoming_items')
    .select('*')
    .eq('source_url', sourceUrl)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await supabase
    .from('incoming_items')
    .insert({
      title,
      description,
      content,
      source_type: 'manual',
      source_url: sourceUrl,
      raw_data: { smoke_test: true } as Json,
      status: 'pending',
      processing_state: 'pending',
      content_hash: contentHash,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(`Smoke-Item konnte nicht erstellt werden: ${error?.message}`)
  return data
}
