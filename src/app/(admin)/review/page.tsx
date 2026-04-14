import { PageHeader } from '@/components/layout/PageHeader'

export default function ReviewPage() {
  return (
    <div>
      <PageHeader
        title="Review-Queue"
        description="Eingehende Inhalte prüfen und einordnen"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats */}
        <div className="lg:col-span-3 grid grid-cols-4 gap-4">
          {[
            { label: 'Ausstehend', count: 0, color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { label: 'Genehmigt', count: 0, color: 'bg-green-50 text-green-700 border-green-200' },
            { label: 'Abgelehnt', count: 0, color: 'bg-red-50 text-red-700 border-red-200' },
            { label: 'Bearbeitung nötig', count: 0, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-lg border p-4 ${stat.color}`}>
              <p className="text-xs opacity-70 mb-1">{stat.label}</p>
              <p className="text-2xl font-medium">{stat.count}</p>
            </div>
          ))}
        </div>

        {/* Queue */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-700">Ausstehende Einträge</h2>
              <div className="flex gap-2">
                <select className="rounded-md border border-gray-200 px-3 py-1.5 text-xs bg-white">
                  <option>Alle Quellen</option>
                  <option>Manuell</option>
                  <option>CSV Import</option>
                  <option>RSS Feed</option>
                  <option>API</option>
                </select>
              </div>
            </div>

            <div className="p-10 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <span className="text-xl text-gray-400">✓</span>
              </div>
              <p className="text-sm text-gray-500 mb-2">Keine ausstehenden Einträge</p>
              <p className="text-xs text-gray-400">
                Neue Einträge aus Imports oder Feeds erscheinen hier zur Prüfung.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
