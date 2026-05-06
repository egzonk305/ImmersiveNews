import type { TopicWithPath } from '@/lib/types/database.types'

export interface ItemForPrompt {
  title: string
  description: string | null
  content: string | null
}

export interface BuildPromptOptions {
  item: ItemForPrompt
  allowedTopics: Pick<TopicWithPath, 'id' | 'full_path' | 'level'>[]
  maxCandidates: number
  maxDepth: number
}

export interface PromptResult {
  prompt: string
  indexMap: Record<number, string> // index → topic_id
}

export function buildClassifierPrompt(opts: BuildPromptOptions): PromptResult {
  const filtered = opts.allowedTopics.filter(t => t.level <= opts.maxDepth)

  const indexMap: Record<number, string> = {}
  const topicsList = filtered.map((t, i) => {
    indexMap[i + 1] = t.id
    return `${i + 1}:${t.full_path}`
  }).join('\n')

  const description = (opts.item.description ?? '').slice(0, 300)
  const content = opts.item.content ? opts.item.content.slice(0, 800) : null

  const artikelBlock = [
    `Title: ${opts.item.title}`,
    `Description: ${description || '(none)'}`,
    content ? `Text excerpt: ${content}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `Classify the article. Choose at most ${opts.maxCandidates} topics. Exactly one must have is_primary:true.

TOPICS:
${topicsList}

ARTICLE:
${artikelBlock}

Reply only with JSON, no markdown:
{"candidates":[{"n":1,"confidence":0.85,"is_primary":true}]}`

  return { prompt, indexMap }
}
