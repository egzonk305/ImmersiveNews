import { PageHeader } from '@/components/layout/PageHeader'

export default function FeedsSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Feed-Einstellungen"
        description="RSS-Feeds und externe Quellen konfigurieren"
      />

      <div className="max-w-2xl space-y-6">
        {/* Aktive Feeds */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">Aktive Feeds</h2>
            <button className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 transition-colors">
              + Feed hinzufügen
            </button>
          </div>

          <div className="p-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
              <span className="text-xl text-gray-400">⟳</span>
            </div>
            <p className="text-sm text-gray-500 mb-2">Noch keine Feeds konfiguriert</p>
            <p className="text-xs text-gray-400">
              Füge RSS-Feeds oder API-Endpunkte hinzu, um automatisch neue Inhalte zu erhalten.
            </p>
          </div>
        </div>

        {/* Einstellungen */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-medium text-gray-700 border-b border-gray-100 pb-3">
            Allgemeine Einstellungen
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Automatischer Import</p>
                <p className="text-xs text-gray-400">Neue Feed-Einträge automatisch in die Review-Queue übernehmen</p>
              </div>
              <div className="w-10 h-5 bg-gray-200 rounded-full relative cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Duplikaterkennung</p>
                <p className="text-xs text-gray-400">Einträge mit identischem Namen automatisch markieren</p>
              </div>
              <div className="w-10 h-5 bg-blue-500 rounded-full relative cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Abfrage-Intervall</p>
                <p className="text-xs text-gray-400">Wie oft neue Feeds abgefragt werden</p>
              </div>
              <select className="rounded-md border border-gray-200 px-3 py-1.5 text-xs bg-white">
                <option>Alle 15 Minuten</option>
                <option>Stündlich</option>
                <option>Alle 6 Stunden</option>
                <option>Täglich</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
