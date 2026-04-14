import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-6">
          <span className="text-2xl text-gray-400">?</span>
        </div>
        <h1 className="text-lg font-medium text-gray-800 mb-2">Seite nicht gefunden</h1>
        <p className="text-sm text-gray-500 mb-6">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
          >
            Zum Dashboard
          </Link>
          <Link
            href="/topics"
            className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Topics
          </Link>
        </div>
      </div>
    </div>
  )
}
