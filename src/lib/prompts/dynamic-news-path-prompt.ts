import type {
  RelevantPath,
  RelevantStory,
  RelevantTopic,
} from '@/lib/services/dynamic-news-path.service'

export interface DynamicNewsPathPromptInput {
  source: string | null
  rss_category: string | null
  url: string | null
  published_at: string | null
  title: string
  description: string | null
  text_excerpt: string | null
  existing_relevant_topics: RelevantTopic[]
  existing_relevant_paths: RelevantPath[]
  existing_similar_stories: RelevantStory[]
}

export function buildDynamicNewsPathPrompt(input: DynamicNewsPathPromptInput) {
  const leanTopics = input.existing_relevant_topics.map(t => ({ label: t.label, path: t.path }))
  const leanPaths = input.existing_relevant_paths.map(p => p.path)
  const leanStories = input.existing_similar_stories.map(s => ({
    key: s.story_key,
    title: s.title,
    summary: s.current_summary?.slice(0, 120) ?? null,
  }))

  return `You generate semantic navigation paths for news articles. Reply only with valid JSON.

Root topics: Natur | Politik | Sport | Technik

Rules:
- 1 to 4 paths, each 4 to 8 levels deep. First node = root topic, last node = short article headline in German.
- Prefer existing topics and paths. New segments must be general enough to apply to future articles.
- Use canonical German terms; proper names stay in their original language.
- If the article updates an existing story: updates_existing_story=true. If newer/more relevant: should_replace_latest_item=true.
- Only state facts from the article. No markdown, no explanation.

Typical path patterns:
- Football: Sport > Fussball > Liga/Wettbewerb > Team > Headline
- Politics: Politik > Land/Region > Partei/Institution > Ereignis > Headline
- Tech: Technik > Bereich > Unternehmen/Produkt > Ereignis > Headline
- Nature: Natur > Bereich > Ort/Phaenomen > Ereignis > Headline

ARTICLE:
Source: ${input.source ?? ''}
Date: ${input.published_at ?? ''}
Title: ${input.title}
Description: ${input.description ?? ''}
Text: ${input.text_excerpt ?? ''}

EXISTING TOPICS:
${JSON.stringify(leanTopics)}

EXISTING PATHS:
${JSON.stringify(leanPaths)}

SIMILAR STORIES:
${JSON.stringify(leanStories)}

AUSGABE-BEISPIEL (Werte durch echte Inhalte ersetzen):
{
  "root_topic": "Sport",
  "headline": "Bayern gewinnt gegen Dortmund",
  "description": "Bayern Muenchen setzt sich im Spitzenkampf durch und vergroessert den Tabellenvorsprung.",
  "summary_short": "Bayern schlaegt Dortmund 2:1 in einem engen Bundesliga-Topspiel.",
  "paths": [
    {
      "path": ["Sport", "Fussball", "Deutschland", "Bundesliga", "Bayern Muenchen", "Bayern gewinnt gegen Dortmund"],
      "confidence": 0.95
    }
  ],
  "story": {
    "story_key": "bundesliga-titelrennen-2024",
    "title": "Bundesliga Titelrennen 2024",
    "updates_existing_story": false,
    "existing_story_id": null,
    "should_replace_latest_item": false,
    "new_current_summary": "Bayern fuehrt die Bundesliga nach dem Sieg gegen Dortmund an."
  },
  "entities": {
    "people": ["Thomas Mueller"],
    "organizations": ["FC Bayern Muenchen", "Borussia Dortmund"],
    "places": ["Muenchen"],
    "teams": ["FC Bayern Muenchen", "Borussia Dortmund"],
    "competitions": ["Bundesliga"],
    "technologies": [],
    "topics": ["Fussball", "Bundesliga"]
  },
  "merge_suggestions": []
}`
}
