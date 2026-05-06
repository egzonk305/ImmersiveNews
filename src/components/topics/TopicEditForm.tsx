'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { z } from 'zod'
import { levelLabel } from '@/lib/utils'
import type { Topic } from '@/lib/types/database.types'

const editSchema = z.object({
  name: z
    .string()
    .min(1, 'Name darf nicht leer sein')
    .max(200, 'Name darf maximal 200 Zeichen haben')
    .trim(),
  parent_id: z.string().uuid('Ungültige Parent-ID').nullable().optional(),
  description: z.string().max(2000, 'Beschreibung zu lang').nullable().optional(),
})

type EditInput = z.infer<typeof editSchema>

interface TopicEditFormProps {
  topic: Topic
  possibleParents: Pick<Topic, 'id' | 'name' | 'level'>[]
}

export function TopicEditForm({ topic, possibleParents }: TopicEditFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const isFixedRoot = topic.is_fixed_root === true

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditInput>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: topic.name,
      parent_id: topic.parent_id,
      description: topic.description ?? '',
    },
  })

  const onSubmit = async (data: EditInput) => {
    setServerError(null)
    // Leerer String aus dem Select bedeutet Root-Ebene → null
    if (data.parent_id === '') data.parent_id = null
    try {
      // Name + Description (Patch)
      const patch: Record<string, unknown> = {}
      if (!isFixedRoot && data.name !== topic.name) patch.name = data.name
      if ((data.description ?? '') !== (topic.description ?? '')) {
        patch.description = data.description ?? null
      }
      if (Object.keys(patch).length > 0) {
        const res = await fetch(`/api/topics/${topic.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const json = await res.json()
        if (!res.ok) {
          setServerError(json.error ?? 'Fehler beim Speichern')
          return
        }
      }

      // Verschieben (nicht für Root-Topics)
      if (!isFixedRoot && data.parent_id !== topic.parent_id && data.parent_id !== undefined) {
        const res = await fetch(`/api/topics/${topic.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_parent_id: data.parent_id }),
        })
        const json = await res.json()
        if (!res.ok) {
          setServerError(json.error ?? 'Fehler beim Verschieben')
          return
        }
      }

      router.push(`/topics/${topic.id}`)
      router.refresh()
    } catch {
      setServerError('Netzwerkfehler – bitte erneut versuchen')
    }
  }

  const handleDelete = async (force = false) => {
    setIsDeleting(true)
    setServerError(null)
    try {
      const res = await fetch(`/api/topics/${topic.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const json = await res.json()

      if (res.status === 409 && !force) {
        setShowDeleteConfirm(true)
        setServerError(json.error)
        setIsDeleting(false)
        return
      }

      if (!res.ok) {
        setServerError(json.error ?? 'Fehler beim Löschen')
        setIsDeleting(false)
        return
      }

      router.push(topic.parent_id ? `/topics/${topic.parent_id}` : '/topics')
      router.refresh()
    } catch {
      setServerError('Netzwerkfehler – bitte erneut versuchen')
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Bearbeiten-Formular */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">
          Eigenschaften bearbeiten
        </h2>

        {isFixedRoot && (
          <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800">
            🔒 Geschütztes Root-Thema – Name und Position sind fixiert. Nur die Beschreibung kann geändert werden.
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register('name')}
            type="text"
            autoFocus={!isFixedRoot}
            disabled={isFixedRoot}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
          />
          {errors.name && (
            <p className="mt-1.5 text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>

        {/* Beschreibung */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Beschreibung <span className="text-gray-400 font-normal">(optional, hilft der KI)</span>
          </label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Kurzbeschreibung des Themas — wird vom Klassifizierer als Kontext mitgegeben."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errors.description && (
            <p className="mt-1.5 text-xs text-red-500">{errors.description.message}</p>
          )}
        </div>

        {/* Parent */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Übergeordnetes Topic
          </label>
          <select
            {...register('parent_id')}
            disabled={isFixedRoot}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">— Root-Thema (Level 1) —</option>
            {[1, 2, 3, 4].map((level) => (
              <optgroup key={level} label={levelLabel(level)}>
                {possibleParents
                  .filter((p) => p.level === level)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Server-Fehler */}
        {serverError && !showDeleteConfirm && (
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-600">
            {serverError}
          </div>
        )}

        {/* Aktionen */}
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Wird gespeichert…' : 'Änderungen speichern'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </form>

      {/* Gefahrenzone */}
      {!isFixedRoot && (
        <div className="bg-white rounded-lg border border-red-200 p-6 space-y-4">
          <h2 className="text-sm font-medium text-red-700 border-b border-red-100 pb-3">
            Gefahrenzone
          </h2>

          <p className="text-sm text-gray-600">
            Das Löschen dieses Topics kann nicht rückgängig gemacht werden.
            {topic.level < 8 && ' Alle untergeordneten Einträge werden ebenfalls gelöscht.'}
          </p>

          {showDeleteConfirm ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-3">
              <p className="text-sm text-red-700 font-medium">
                {serverError}
              </p>
              <p className="text-sm text-red-600">
                Möchtest du dieses Topic und alle Untereinträge wirklich löschen?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(true)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? 'Wird gelöscht…' : 'Ja, alles löschen'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setServerError(null) }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => handleDelete(false)}
              disabled={isDeleting}
              className="px-4 py-2 bg-white text-red-600 text-sm border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {isDeleting ? 'Wird gelöscht…' : 'Topic löschen'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
