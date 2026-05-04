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
    `Titel: ${opts.item.title}`,
    `Beschreibung: ${description || '(keine)'}`,
    content ? `Volltext (Auszug): ${content}` : null,
  ].filter(Boolean).join('\n')

  // Prompt endet mit JSON-Prefix — LLM vervollständigt, tryParseJson setzt es wieder vorne an
  const prompt = `Klassifiziere den Artikel. Wähle maximal ${opts.maxCandidates} Themen-Nummern aus der Liste. Genau einer hat is_primary:true.

THEMEN:
${topicsList}

ARTIKEL:
${artikelBlock}

Antworte NUR mit diesem JSON-Objekt, keine Erklärung, kein Markdown:
{"candidates":[{"n":NUMMER,"confidence":0.0-1.0,"is_primary":true/false}]}`

  return { prompt, indexMap }
}
