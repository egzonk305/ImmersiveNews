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

export function buildClassifierPrompt(opts: BuildPromptOptions): string {
  const topicsList = opts.allowedTopics
    .filter(t => t.level <= opts.maxDepth)
    .map(t => `- ${t.id} | ${t.full_path}`)
    .join('\n')

  const content = (opts.item.content ?? opts.item.description ?? '').slice(0, 2000)

  return `Du bist ein deutschsprachiger Nachrichten-Klassifikator. Deine Aufgabe: ordne den folgenden Artikel den passendsten Pfaden aus dem Themenbaum zu.

REGELN:
- Wähle ausschließlich aus den unten gelisteten Topic-IDs.
- Erfinde KEINE neuen Topics, KEINE neuen Root-Themen, KEINE freien Kategorien.
- Maximal ${opts.maxCandidates} Kandidaten.
- Genau EIN Kandidat hat is_primary: true.
- "confidence" ist eine Zahl zwischen 0 und 1.
- "reason" ist eine kurze deutsche Begründung (max. 200 Zeichen).
- Antworte STRENG als JSON, ohne Markdown, ohne Kommentare, ohne Erklärung außerhalb des JSON.

ERLAUBTE TOPICS (id | pfad):
${topicsList}

ARTIKEL:
Titel: ${opts.item.title}
Beschreibung: ${opts.item.description ?? '(keine)'}
Inhalt: ${content || '(kein zusätzlicher Inhalt)'}

ANTWORTFORMAT:
{
  "candidates": [
    {
      "topic_id": "<uuid>",
      "path": ["Sport", "Fußball", "Bundesliga"],
      "confidence": 0.91,
      "is_primary": true,
      "reason": "kurze Begründung"
    }
  ]
}`
}
