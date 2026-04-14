'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Admin error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-5">
          <span className="text-xl text-red-400">!</span>
        </div>
        <h1 className="text-base font-medium text-gray-800 mb-2">Fehler</h1>
        <p className="text-sm text-gray-500 mb-5">
          {error.message || 'Ein unerwarteter Fehler ist aufgetreten.'}
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  )
}
