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

// Baut einen kompakten Prompt — Topics als nummerierte Kurzliste statt UUIDs+Pfade.
// Reduziert Token-Anzahl von ~16k auf ~2-3k.
export function buildClassifierPrompt(opts: BuildPromptOptions): PromptResult {
  const filtered = opts.allowedTopics.filter(t => t.level <= opts.maxDepth)

  const indexMap: Record<number, string> = {}
  const topicsList = filtered.map((t, i) => {
    indexMap[i + 1] = t.id
    // Nur letzten Teil des Pfades anzeigen spart Token
    const parts = t.full_path.split(' > ')
    const label = parts.length > 2 ? parts.slice(-2).join(' > ') : t.full_path
    return `${i + 1}:${label}`
  }).join('\n')

  const description = (opts.item.description ?? '').slice(0, 400)

  const prompt = `Antworte NUR mit einem JSON-Objekt in exakt diesem Format:
{"candidates":[{"n":NUMMER,"confidence":0.0-1.0,"is_primary":true,"reason":"Begründung"}]}

Feld "n" = Nummer aus der Themenliste unten. Maximal ${opts.maxCandidates} Kandidaten. Genau einer hat is_primary:true.

THEMEN:
${topicsList}

ARTIKEL:
Titel: ${opts.item.title}
Beschreibung: ${description || '(keine)'}

JSON:`

  return { prompt, indexMap }
}
