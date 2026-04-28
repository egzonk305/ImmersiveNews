// Dünner HTTP-Wrapper für Ollama (https://github.com/ollama/ollama/blob/main/docs/api.md)

export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'OllamaError'
  }
}

export interface OllamaModel {
  name: string
  size?: number
  modified_at?: string
  digest?: string
}

export interface OllamaTagsResponse {
  models: OllamaModel[]
}

export async function listModels(baseUrl: string): Promise<OllamaModel[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/tags`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) {
      throw new OllamaError(`Ollama /api/tags HTTP ${res.status}`)
    }
    const json = (await res.json()) as OllamaTagsResponse
    return json.models ?? []
  } catch (err) {
    if (err instanceof OllamaError) throw err
    throw new OllamaError(
      `Ollama nicht erreichbar unter ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }
}

export interface GenerateOptions {
  baseUrl: string
  model: string
  prompt: string
  format?: 'json'
  temperature?: number
  timeoutMs?: number
}

export interface GenerateResult {
  response: string
  model: string
  total_duration_ns?: number
}

export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/api/generate`
  const body = {
    model: opts.model,
    prompt: opts.prompt,
    stream: false,
    format: opts.format,
    options: {
      temperature: opts.temperature ?? 0.2,
      num_ctx: 8192,
      num_predict: 400,
    },
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    })
  } catch (err) {
    throw new OllamaError(
      `Ollama-Aufruf fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new OllamaError(`Ollama HTTP ${res.status}: ${text.slice(0, 500)}`)
  }

  const json = (await res.json()) as {
    response?: string
    model?: string
    total_duration?: number
  }

  if (typeof json.response !== 'string') {
    throw new OllamaError('Ollama-Antwort enthält kein "response"-Feld')
  }

  return {
    response: json.response,
    model: json.model ?? opts.model,
    total_duration_ns: json.total_duration,
  }
}
