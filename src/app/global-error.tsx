'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center max-w-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-6">
              <span className="text-2xl text-red-400">!</span>
            </div>
            <h1 className="text-lg font-medium text-gray-800 mb-2">Ein Fehler ist aufgetreten</h1>
            <p className="text-sm text-gray-500 mb-6">
              {error.message || 'Unbekannter Fehler'}
            </p>
            <button
              onClick={reset}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
