import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listModels } from '@/lib/services/ollama.client'
import { formatError } from '@/lib/utils'
import { z } from 'zod'

const bodySchema = z
  .object({
    ollama_base_url: z.string().url().optional(),
    model_name: z.string().optional(),
  })
  .optional()

// POST /api/classifier-settings/test-connection
// Body optional: kann eine andere Base-URL prüfen, ohne sie zu speichern.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    let baseUrl: string | null = null
    let modelName: string | null = null

    try {
      const body = await request.json()
      const parsed = bodySchema.parse(body)
      if (parsed?.ollama_base_url) baseUrl = parsed.ollama_base_url
      if (parsed?.model_name) modelName = parsed.model_name
    } catch {
      // body optional
    }

    if (!baseUrl || !modelName) {
      const { data: settings } = await supabase
        .from('classifier_settings')
        .select('ollama_base_url, model_name')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      baseUrl = baseUrl ?? settings?.ollama_base_url ?? 'http://localhost:11434'
      modelName = modelName ?? settings?.model_name ?? 'qwen3:8b'
    }

    const models = await listModels(baseUrl)
    const has = models.some(m => m.name === modelName || m.name.startsWith(`${modelName}:`))

    return NextResponse.json({
      data: {
        ok: true,
        base_url: baseUrl,
        configured_model: modelName,
        model_available: has,
        models: models.map(m => m.name),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: formatError(error), data: { ok: false } },
      { status: 502 }
    )
  }
}
