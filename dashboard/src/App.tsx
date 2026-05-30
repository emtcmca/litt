import { useEffect, useState } from 'react'

export default function App() {
  const [health, setHealth] = useState<{ status: string; firm_id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError('Backend unreachable'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Demo mode banner */}
      <div className="bg-amber-400 text-amber-900 text-sm font-medium text-center py-2 px-4">
        DEMO MODE — Strand &amp; Okafor LLP — Synthetic data only — May 29, 2026
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Litt</h1>
          <p className="text-gray-500 mb-8 text-sm">
            The operational control layer for small law firms.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
              {error} — is the backend running?
            </div>
          )}

          {health && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 mb-6 text-sm">
              Backend connected — firm: <strong>{health.firm_id}</strong>
            </div>
          )}

          <div className="text-xs text-gray-400 space-y-1">
            <p>Daily Closeout Brief — coming Day 3</p>
            <p>Action modals — coming Day 5</p>
          </div>
        </div>
      </div>
    </div>
  )
}
