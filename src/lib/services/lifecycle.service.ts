import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, LifecycleRunInsert } from '@/lib/types/database.types'
import { getSettings } from '@/lib/services/classifier.service'

export interface LifecycleResult {
  run_id: string
  archived_count: number
  deleted_count: number
  dry_run: boolean
  error: string | null
}

export async function runLifecycle(
  supabase: SupabaseClient<Database>,
  dryRun = false
): Promise<LifecycleResult> {
  const settings = await getSettings(supabase)
  const now = new Date()

  const freshThreshold = new Date(
    now.getTime() - settings.fresh_ttl_hours * 3_600_000
  ).toISOString()

  const deleteThreshold = new Date(
    now.getTime() - settings.archive_retention_days * 86_400_000
  ).toISOString()

  let archivedCount = 0
  let deletedCount = 0
  let runError: string | null = null

  try {
    // --- Archivieren: fresh → archived ---
    // Items older than fresh_ttl_hours, not yet archived, and not approved (if keep_approved_forever)
    let archiveQuery = supabase
      .from('incoming_items')
      .select('id')
      .lt('created_at', freshThreshold)
      .eq('lifecycle_state', 'fresh')

    if (settings.keep_approved_forever) {
      archiveQuery = archiveQuery.neq('status', 'approved')
    }

    const { data: toArchive, error: archiveSelectError } = await archiveQuery
    if (archiveSelectError) throw new Error(archiveSelectError.message)

    archivedCount = toArchive?.length ?? 0

    if (!dryRun && archivedCount > 0) {
      const ids = toArchive!.map(i => i.id)
      const { error: archiveUpdateError } = await supabase
        .from('incoming_items')
        .update({
          lifecycle_state: 'archived',
          archived_at: now.toISOString(),
        })
        .in('id', ids)
      if (archiveUpdateError) throw new Error(archiveUpdateError.message)
    }

    // --- Löschen: archived → deleted ---
    // Items archived before deleteThreshold
    const { data: toDelete, error: deleteSelectError } = await supabase
      .from('incoming_items')
      .select('id, target_topic_id')
      .lt('archived_at', deleteThreshold)
      .eq('lifecycle_state', 'archived')

    if (deleteSelectError) throw new Error(deleteSelectError.message)

    let candidatesForDeletion = toDelete ?? []

    if (settings.keep_with_topic_associations) {
      candidatesForDeletion = candidatesForDeletion.filter(i => !i.target_topic_id)
    }
    if (settings.keep_approved_forever) {
      // Approved items always have target_topic_id — already filtered above if keep_with_topic_associations.
      // Additionally filter by status for safety when keep_with_topic_associations is false.
      const { data: approvedIds } = await supabase
        .from('incoming_items')
        .select('id')
        .in('id', candidatesForDeletion.map(i => i.id))
        .eq('status', 'approved')
      const approvedSet = new Set(approvedIds?.map(i => i.id) ?? [])
      candidatesForDeletion = candidatesForDeletion.filter(i => !approvedSet.has(i.id))
    }

    deletedCount = candidatesForDeletion.length

    if (!dryRun && deletedCount > 0) {
      const ids = candidatesForDeletion.map(i => i.id)
      const { error: deleteUpdateError } = await supabase
        .from('incoming_items')
        .update({ lifecycle_state: 'deleted' })
        .in('id', ids)
      if (deleteUpdateError) throw new Error(deleteUpdateError.message)
    }
  } catch (err) {
    runError = err instanceof Error ? err.message : String(err)
  }

  // Log the run
  const runInsert: LifecycleRunInsert = {
    dry_run: dryRun,
    finished_at: new Date().toISOString(),
    archived_count: archivedCount,
    deleted_count: deletedCount,
    cache_pruned_count: 0,
    archived_summary: null,
    deleted_summary: null,
    error: runError,
  }

  const { data: runData } = await supabase
    .from('lifecycle_runs')
    .insert(runInsert)
    .select('id')
    .single()

  return {
    run_id: runData?.id ?? '',
    archived_count: archivedCount,
    deleted_count: deletedCount,
    dry_run: dryRun,
    error: runError,
  }
}
