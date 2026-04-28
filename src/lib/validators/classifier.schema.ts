import { z } from 'zod'

export const classifierSettingsUpdateSchema = z.object({
  ollama_base_url: z.string().url().optional(),
  model_name: z.string().min(1).max(100).optional(),
  max_candidates: z.number().int().min(1).max(10).optional(),
  max_depth: z.number().int().min(1).max(5).optional(),
  confidence_threshold: z.number().min(0).max(1).optional(),
  auto_accept_enabled: z.boolean().optional(),
})
export type ClassifierSettingsUpdateInput = z.infer<typeof classifierSettingsUpdateSchema>

export const classifierCandidateSchema = z.object({
  topic_id: z.string().uuid(),
  path: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  is_primary: z.boolean(),
  reason: z.string().max(2000).optional().nullable(),
})

export const classifierResponseSchema = z.object({
  candidates: z.array(classifierCandidateSchema).min(1).max(10),
})
export type ClassifierResponse = z.infer<typeof classifierResponseSchema>
export type ClassifierCandidate = z.infer<typeof classifierCandidateSchema>

// Kompaktes Format: LLM gibt Nummern-Index zurück statt UUIDs
export const compactCandidateSchema = z.object({
  n: z.number().int().min(1),
  confidence: z.number().min(0).max(1),
  is_primary: z.boolean(),
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
