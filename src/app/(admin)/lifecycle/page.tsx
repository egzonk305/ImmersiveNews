import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import type { LifecycleRun } from '@/lib/types/database.types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'gerade eben'
  if (diffMin < 60) return `vor ${diffMin} Min.`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `vor ${diffH} Std.`
  const diffD = Math.floor(diffH / 24)
  return `vor ${diffD} Tag${diffD === 1 ? '' : 'en'}`
}

export default async function LifecyclePage() {
  const supabase = await createClient()
  const { data: runs } = await supabase
    .from('lifecycle_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  const typedRuns = (runs ?? []) as LifecycleRun[]

  return (
    <div>
      <PageHeader
        title="Lifecycle-Management"
        description="Archiviert Items nach Ablauf der TTL, markiert archivierte Items nach Retention-Frist als gelöscht."
        icon="♻"
      />

      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Items werden nach <strong>fresh_ttl_hours</strong> Stunden archiviert (fresh → archived) und
        nach <strong>archive_retention_days</strong> Tagen als gelöscht markiert (archived → deleted).
        Genehmigte Items und Items mit Topic-Zuordnung bleiben je nach Einstellung erhalten.
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_80px_80px_80px_80px_100px] gap-3 border-b border-gray-100 px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50">
          <span>Zeitpunkt</span>
          <span className="text-center">Archiviert</span>
          <span className="text-center">Gelöscht</span>
          <span className="text-center">Cache</span>
          <span className="text-center">Dry-Run</span>
          <span className="text-center">Status</span>
        </div>

        {typedRuns.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Noch keine Lifecycle-Läufe vorhanden. Starte einen Lauf via{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">
              POST /api/cron/lifecycle
            </code>
            .
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {typedRuns.map((run) => {
              const isError = !!run.error
              const isDry = run.dry_run

              return (
                <li
                  key={run.id}
                  className="grid grid-cols-[1fr_80px_80px_80px_80px_100px] gap-3 items-center px-4 py-3"
                >
                  {/* Zeitpunkt */}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">{formatDate(run.started_at)}</p>
                    <p className="text-xs text-gray-400">{timeAgo(run.started_at)}</p>
                    {run.error && (
                      <p className="mt-0.5 text-xs text-red-600 truncate" title={run.error}>
                        {run.error}
                      </p>
                    )}
                  </div>

                  {/* Archiviert */}
                  <span className="text-center text-sm font-medium text-gray-700">
                    {run.archived_count}
                  </span>

                  {/* Gelöscht */}
                  <span className="text-center text-sm font-medium text-gray-700">
                    {run.deleted_count}
                  </span>

                  {/* Cache pruned */}
                  <span className="text-center text-sm text-gray-500">
                    {run.cache_pruned_count}
                  </span>

                  {/* Dry-Run badge */}
                  <span className="flex justify-center">
                    {isDry ? (
                      <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        Dry
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </span>

                  {/* Status */}
                  <span className="flex justify-center">
                    {isError ? (
                      <span className="inline-flex items-center rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                        Fehler
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                        OK
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">{typedRuns.length} Einträge (max. 50)</span>
          <code className="text-[10px] text-gray-400 font-mono">
            POST /api/cron/lifecycle[?dry_run=true]
          </code>
        </div>
      </div>
    </div>
  )
}
