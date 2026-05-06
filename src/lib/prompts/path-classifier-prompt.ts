export interface PathPromptOptions {
  title: string
  description: string | null
  content: string | null
}

export function buildPathClassifierPrompt(opts: PathPromptOptions): string {
  const desc = (opts.description ?? '').slice(0, 400).trim()
  const text = opts.content ? opts.content.slice(0, 1000).trim() : null

  const articleBlock = [
    `Titel: ${opts.title}`,
    desc ? `Beschreibung: ${desc}` : null,
    text ? `Auszug: ${text}` : null,
  ].filter(Boolean).join('\n')

  return `Klassifiziere den Nachrichtenartikel und erstelle einen Themenpfad.

REGELN:
- root_topic: genau eines von: Sport, Natur, Politik, Technik
- path: Array mit 2-5 Labels, von allgemein zu spezifisch, erstes Label = root_topic
- Jedes Label max. 60 Zeichen, kurz und prägnant
- headline: prägnante Schlagzeile auf Deutsch, max. 120 Zeichen
- summary: 2-3 Sätze Zusammenfassung auf Deutsch, max. 400 Zeichen

BEISPIELE:
{"root_topic":"Sport","path":["Sport","Fußball","Champions League","Halbfinale"],"headline":"Arsenal besiegt Atlético im Halbfinale","summary":"Arsenal qualifiziert sich mit einem 2:1-Sieg gegen Atlético Madrid für das CL-Finale. Beide Teams lieferten ein intensives Spiel."}
{"root_topic":"Technik","path":["Technik","Künstliche Intelligenz","Sprachmodelle"],"headline":"Neues KI-Modell übertrifft GPT-4 in Benchmarks","summary":"Ein neues Sprachmodell erzielt in mehreren Benchmarks bessere Ergebnisse als GPT-4. Forscher heben besonders die Effizienz hervor."}
{"root_topic":"Politik","path":["Politik","Deutschland","Bundesregierung","Wirtschaftspolitik"],"headline":"Bundesregierung beschließt neues Konjunkturpaket","summary":"Das Kabinett hat ein Konjunkturpaket in Höhe von 20 Milliarden Euro verabschiedet. Die Maßnahmen sollen die Wirtschaft ankurbeln."}

ARTIKEL:
${articleBlock}

Antworte NUR mit JSON, kein Markdown, keine Erklärung:`
}
