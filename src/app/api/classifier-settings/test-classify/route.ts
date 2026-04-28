import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSettings, getAllowedTopics } from '@/lib/services/classifier.service'
import { generate } from '@/lib/services/ollama.client'
import { buildClassifierPrompt } from '@/lib/prompts/classifier-prompt'
import { compactResponseSchema } from '@/lib/validators/classifier.schema'
import { formatError } from '@/lib/utils'
import { z } from 'zod'

const sampleSchema = z.object({
  title: z.string().min(1).default('Bayern prüft neuen Mittelfeldtransfer'),
  description: z
    .string()
    .nullable()
    .default('Laut Medienberichten beobachtet der Verein einen Spieler aus England.'),
  content: z.string().nullable().default(null),
})

// POST /api/classifier-settings/test-classify
// Führt eine Test-Klassifikation gegen das aktuell konfigurierte Modell aus.
// Schreibt NICHTS in die Datenbank — nur Diagnose.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    let payload = sampleSchema.parse({})
    try {
      const body = await request.json()
      payload = sampleSchema.parse(body)
    } catch {
      // body optional
    }

    const settings = await getSettings(supabase)
    const allowed = await getAllowedTopics(supabase)
    const { prompt, indexMap } = buildClassifierPrompt({
      item: payload,
      allowedTopics: allowed.map(t => ({ id: t.id, full_path: t.full_path, level: t.level })),
      maxCandidates: settings.max_candidates,
      maxDepth: settings.max_depth,
    })

    const start = Date.now()
    const result = await generate({
      baseUrl: settings.ollama_base_url,
      model: settings.model_name,
      prompt,
      format: 'json',
      temperature: 0.2,
      timeoutMs: 360_000,
    })
    const duration_ms = Date.now() - start

    let parsed: unknown = null
    try {
      parsed = JSON.parse(result.response)
    } catch {
      const m = result.response.match(/\{[\s\S]*\}/)
      if (m) {
        try { parsed = JSON.parse(m[0]) } catch { /* noop */ }
      }
    }

    const validated = parsed
      ? compactResponseSchema.safeParse(parsed)
      : null
    const allowedIds = new Set(allowed.map(t => t.id))
    const validCount = validated?.success
      ? validated.data.candidates.filter(c => !!indexMap[c.n] && allowedIds.has(indexMap[c.n])).length
      : 0

    return NextResponse.json({
      data: {
        ok: validated?.success ?? false,
        duration_ms,
        model: result.model,
        raw_response: result.response,
        parsed,
        schema_valid: validated?.success ?? false,
        schema_error: validated?.success ? null : validated?.error.errors[0]?.message,
        valid_topic_ids: validCount,
        total_candidates: validated?.success ? validated.data.candidates.length : 0,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 502 })
  }
}
