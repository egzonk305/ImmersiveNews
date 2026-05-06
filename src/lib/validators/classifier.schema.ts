import { z } from 'zod'

export const classifierSettingsUpdateSchema = z.object({
  ollama_base_url: z.string().url().optional(),
  model_name: z.string().min(1).max(100).optional(),
  max_candidates: z.number().int().min(1).max(10).optional(),
  max_depth: z.number().int().min(1).max(8).optional(),
  confidence_threshold: z.number().min(0).max(1).optional(),
  auto_accept_enabled: z.boolean().optional(),
  temperature: z.number().min(0).max(1).optional(),
  num_ctx: z.number().int().min(512).max(131072).optional(),
  num_predict: z.number().int().min(1).max(32768).optional(),
  timeout_ms: z.number().int().min(1000).max(3_600_000).optional(),
})
export type ClassifierSettingsUpdateInput = z.infer<typeof classifierSettingsUpdateSchema>

export const classifierCandidateSchema = z.object({
  topic_id: z.string().uuid(),
  path: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  is_primary: z.boolean(),
  reason: z.string().max(2000).optional().nullable(),
})

export type ClassifierCandidate = z.infer<typeof classifierCandidateSchema>

// Kompaktes Format: LLM gibt Nummern-Index zurück statt UUIDs
export const compactCandidateSchema = z.object({
  n: z.union([z.number(), z.string()]).transform(v => Number(v)).pipe(z.number().int().min(1)),
  confidence: z.union([z.number(), z.string()]).transform(v => Number(v)).pipe(z.number().min(0).max(1)),
  is_primary: z.union([z.boolean(), z.string()]).transform(v => v === true || v === 'true'),
  reason: z.string().max(2000).optional().nullable(),
})
export const compactResponseSchema = z.object({
  candidates: z.array(compactCandidateSchema).min(1).max(10),
})
export type CompactCandidate = z.infer<typeof compactCandidateSchema>

export const candidateConfirmSchema = z.object({
  is_primary: z.boolean().optional(),
})

export const candidateAddSchema = z.object({
  topic_id: z.string().uuid(),
  is_primary: z.boolean().optional(),
  reason: z.string().max(2000).optional().nullable(),
})

export const rootTopicSchema = z.enum(['Natur', 'Politik', 'Sport', 'Technik'])

const dynamicPathSchema = z.object({
  path: z.array(z.string().trim().min(1).max(120)).min(4).max(8),
  confidence: z.number().min(0).max(1),
})

const storySchema = z.object({
  story_key: z.string().trim().min(1).max(180),
  title: z.string().trim().min(1).max(180),
  updates_existing_story: z.boolean(),
  existing_story_id: z.string().uuid().nullish().transform(v => v ?? null),
  should_replace_latest_item: z.boolean(),
  new_current_summary: z.string().trim().max(1200).optional().default(''),
})

const entitiesSchema = z.object({
  people: z.array(z.string().trim().min(1).max(80)).optional().default([]),
  organizations: z.array(z.string().trim().min(1).max(100)).optional().default([]),
  places: z.array(z.string().trim().min(1).max(80)).optional().default([]),
  teams: z.array(z.string().trim().min(1).max(100)).optional().default([]),
  competitions: z.array(z.string().trim().min(1).max(100)).optional().default([]),
  technologies: z.array(z.string().trim().min(1).max(100)).optional().default([]),
  topics: z.array(z.string().trim().min(1).max(100)).optional().default([]),
})

export const dynamicNewsPathResultSchema = z.object({
  root_topic: rootTopicSchema,
  headline: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(600),
  summary_short: z.string().trim().min(1).max(500),
  paths: z.array(dynamicPathSchema).min(1).max(4),
  story: storySchema,
  entities: entitiesSchema.optional().default({}),
  merge_suggestions: z.array(z.object({
    existing_label: z.string().trim().min(1).max(100),
    detected_label: z.string().trim().min(1).max(100),
    canonical_label: z.string().trim().min(1).max(100),
    confidence: z.number().min(0).max(1),
  })).max(10).default([]),
}).superRefine((value, ctx) => {
  for (let i = 0; i < value.paths.length; i++) {
    const path = value.paths[i].path
    if (path[0] !== value.root_topic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paths', i, 'path', 0],
        message: 'Erster Pfadknoten muss root_topic sein',
      })
    }
  }
})

export type DynamicNewsPathResult = z.infer<typeof dynamicNewsPathResultSchema>

// ─── Path-Classifier (neue Architektur) ──────────────────────────────────────

export const pathClassificationSchema = z.object({
  root_topic: z.enum(['Sport', 'Natur', 'Politik', 'Technik']),
  path: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
  headline: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(600),
})

export type PathClassification = z.infer<typeof pathClassificationSchema>
