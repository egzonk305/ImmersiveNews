import { z } from 'zod'

export const createTopicSchema = z.object({
  name: z
    .string()
    .min(1, 'Name darf nicht leer sein')
    .max(200, 'Name darf maximal 200 Zeichen haben')
    .trim(),
  parent_id: z.string().uuid('Ungültige Parent-ID').nullable().optional(),
  description: z.string().max(2000, 'Beschreibung zu lang').nullable().optional(),
})

export const updateTopicSchema = z.object({
  name: z
    .string()
    .min(1, 'Name darf nicht leer sein')
    .max(200, 'Name darf maximal 200 Zeichen haben')
    .trim()
    .optional(),
  parent_id: z.string().uuid('Ungültige Parent-ID').nullable().optional(),
  description: z.string().max(2000, 'Beschreibung zu lang').nullable().optional(),
})

export const moveTopicSchema = z.object({
  new_parent_id: z.string().uuid('Ungültige Ziel-ID'),
})

export const deleteTopicSchema = z.object({
  force: z.boolean().optional().default(false),
})

export type CreateTopicInput = z.infer<typeof createTopicSchema>
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>
export type MoveTopicInput = z.infer<typeof moveTopicSchema>
