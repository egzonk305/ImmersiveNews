'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createTopicSchema, type CreateTopicInput } from '@/lib/validators/topic.schema'
import { levelLabel } from '@/lib/utils'
import type { Topic } from '@/lib/types/database.types'

interface TopicFormProps {
  parentId: string | null
  parentTopic: Topic | null
  possibleParents: Pick<Topic, 'id' | 'name' | 'level'>[]
  defaultValues?: Partial<CreateTopicInput>
  mode?: 'create' | 'edit'
  topicId?: string
  isFixedRoot?: boolean
}

export function TopicForm({
  parentId,
  parentTopic,
  possibleParents,
  defaultValues,
  mode = 'create',
  topicId,
  isFixedRoot = false,
}: TopicFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<CreateTopicInput>({
    resolver: zodResolver(createTopicSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      parent_id: parentId ?? defaultValues?.parent_id ?? null,
      description: defaultValues?.description ?? '',
    },
  })

  const selectedParentId = watch('parent_id')
  const selectedParent = possibleParents.find((p) => p.id === selectedParentId)
  const inferredLevel = selectedParent ? selectedParent.level + 1 : 1

  const onSubmit = async (data: CreateTopicInput) => {
    setServerError(null)
    try {
      const url = mode === 'edit' ? `/api/topics/${topicId}` : '/api/topics'
      const method = mode === 'edit' ? 'PATCH' : 'POST'

      const payload = isFixedRoot && mode === 'edit'
        ? { description: data.description ?? null }
        : data

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        setServerError(json.error ?? 'Ein Fehler ist aufgetreten')
        return
      }

      setSuccess(true)
      router.push(`/topics/${json.data.id}`)
      router.refresh()
    } catch {
      setServerError('Netzwerkfehler – bitte erneut versuchen')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-card rounded-xl p-6 space-y-5">

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
          placeholder="z.B. Hypertrophietraining"
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
        {errors.parent_id && (
          <p className="mt-1.5 text-xs text-red-500">{errors.parent_id.message}</p>
        )}
      </div>

      {/* Vorschau der Ebene */}
      <div className="bg-gray-50 rounded-md px-4 py-3 text-sm text-gray-600">
        Wird angelegt als: <strong>{levelLabel(inferredLevel)}</strong> (Ebene {inferredLevel})
      </div>

      {/* Server-Fehler */}
      {serverError && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-600">
          {serverError}
        </div>
      )}

      {/* Aktionen */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Wird gespeichert…' : mode === 'edit' ? 'Speichern' : 'Anlegen'}
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
  )
}
