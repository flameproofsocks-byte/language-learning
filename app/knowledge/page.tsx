'use client'

// Knowledge Graph Management — lists all saved learning pairs with stats,
// and lets you reset (delete) any graph. Each pair is stored separately
// so different learners don't overwrite each other's progress.

import { useState, useEffect } from 'react'
import Link from 'next/link'

const PAIR_LABELS: Record<string, { from: string; to: string; fromFlag: string; toFlag: string; lang: string; source: string }> = {
  en_es: { from: 'English',    to: 'Spanish',    fromFlag: '🇬🇧', toFlag: '🇪🇸', lang: 'es', source: 'en' },
  en_zh: { from: 'English',    to: 'Mandarin',   fromFlag: '🇬🇧', toFlag: '🇨🇳', lang: 'zh', source: 'en' },
  en_id: { from: 'English',    to: 'Indonesian', fromFlag: '🇬🇧', toFlag: '🇮🇩', lang: 'id', source: 'en' },
  id_en: { from: 'Indonesian', to: 'English',    fromFlag: '🇮🇩', toFlag: '🇬🇧', lang: 'id', source: 'id' },
}

interface GraphEntry {
  key: string
  wordCounts: Record<string, number>
  noteCount: number
  updatedAt: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function KnowledgePage() {
  const [graphs, setGraphs]     = useState<GraphEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [resetting, setResetting] = useState<string | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/knowledge')
    const data = await res.json()
    setGraphs(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function resetGraph(key: string) {
    setResetting(key)
    await fetch(`/api/knowledge/${key}`, { method: 'DELETE' })
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`langlearn_knowledge_${key}`)
    }
    setConfirmKey(null)
    setResetting(null)
    await load()
  }

  const entries: (GraphEntry & { hasData: boolean })[] = Object.keys(PAIR_LABELS).map(key => {
    const found = graphs.find(g => g.key === key)
    return found
      ? { ...found, hasData: true }
      : { key, wordCounts: {}, noteCount: 0, updatedAt: null, hasData: false }
  })

  const unknownEntries = graphs.filter(g => !PAIR_LABELS[g.key])

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-12">
      <div className="w-full max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-gray-400 hover:text-white transition" aria-label="Home">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Knowledge Graphs</h1>
            <p className="text-gray-500 text-sm">Each learning pair has its own separate progress.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-500 text-center py-16">Loading…</div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map(entry => {
              const label        = PAIR_LABELS[entry.key]
              const encountered  = (entry.wordCounts['2'] ?? 0) + (entry.wordCounts['3'] ?? 0) + (entry.wordCounts['4'] ?? 0)
              const known        = entry.wordCounts['4'] ?? 0
              const isConfirming = confirmKey === entry.key
              const isResetting  = resetting  === entry.key

              return (
                <div
                  key={entry.key}
                  className={`rounded-2xl border px-5 py-5 ${
                    entry.hasData ? 'border-gray-700 bg-gray-900' : 'border-gray-800 bg-gray-900/30'
                  }`}
                >
                  {/* Language pair */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <div className="text-xs text-gray-500 uppercase tracking-wider w-16">Speaks</div>
                        <div className="font-semibold">{label.fromFlag} {label.from}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-500 uppercase tracking-wider w-16">Studies</div>
                        <div className="font-semibold">{label.toFlag} {label.to}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 text-right">
                      {entry.hasData ? <>Last session<br />{formatDate(entry.updatedAt)}</> : 'No sessions yet'}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-800 rounded-xl px-4 py-3">
                      <div className="text-2xl font-bold">{entry.hasData ? encountered : '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Words encountered</div>
                    </div>
                    <div className="bg-gray-800 rounded-xl px-4 py-3">
                      <div className="text-2xl font-bold text-green-400">{entry.hasData ? known : '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Words known</div>
                    </div>
                  </div>

                  {/* Actions */}
                  {entry.hasData ? (
                    <div className="flex gap-2">
                      <Link
                        href={`/vocab-graph`}
                        className="flex-1 text-center py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition"
                      >
                        View Graph
                      </Link>
                      {isConfirming ? (
                        <>
                          <button
                            onClick={() => resetGraph(entry.key)}
                            disabled={!!isResetting}
                            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm font-medium transition disabled:opacity-50"
                          >
                            {isResetting ? 'Resetting…' : 'Confirm Reset'}
                          </button>
                          <button
                            onClick={() => setConfirmKey(null)}
                            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmKey(entry.key)}
                          className="px-4 py-2 rounded-lg border border-gray-700 hover:border-red-700 hover:text-red-400 text-sm font-medium text-gray-500 transition"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">
                      Complete a Word Testing or Sentence Game session to create this graph.
                    </p>
                  )}
                </div>
              )
            })}

            {/* Unknown keys (future-proofing) */}
            {unknownEntries.map(entry => (
              <div key={entry.key} className="rounded-2xl border border-gray-800 bg-gray-900/30 px-5 py-4 flex items-center justify-between">
                <span className="text-gray-500 font-mono text-sm">{entry.key}</span>
                {confirmKey === entry.key ? (
                  <div className="flex gap-2 text-sm">
                    <button onClick={() => resetGraph(entry.key)} className="text-red-400 hover:text-red-300">Confirm</button>
                    <button onClick={() => setConfirmKey(null)} className="text-gray-500">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmKey(entry.key)} className="text-xs text-gray-600 hover:text-red-400 transition">Reset</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
