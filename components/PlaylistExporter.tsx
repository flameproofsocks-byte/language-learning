// PlaylistExporter — turn a playlist into a downloadable zip of audio + transcripts.
//
// Source is a YouTube / YouTube Music playlist link, or a zip of the user's own audio files
// (Spotify audio is DRM-protected, so it isn't fetchable). Starts a /api/playlist job, shows
// per-song progress, and offers a zip of <id>.mp3 + <id>.<lang>.txt + <id>.en.txt (timestamped) and a playlist.json manifest.

'use client'

import { useEffect, useRef, useState } from 'react'
import { Language, LANGUAGE_NAMES } from '@/lib/language'
import type { PlaylistStatus } from '@/lib/transcribe-jobs'

type Source = 'link' | 'zip'

const STATE_LABEL: Record<string, string> = {
  pending: 'waiting', downloaded: 'waiting', downloading: 'downloading…',
  transcribing: 'transcribing…', done: 'done', error: 'failed',
}

export default function PlaylistExporter({ lang }: { lang: Language }) {
  const [source, setSource] = useState<Source>('link')
  const [url, setUrl]       = useState('')
  const [zip, setZip]       = useState<File | null>(null)
  const [jobId, setJobId]   = useState<string | null>(null)
  const [status, setStatus] = useState<PlaylistStatus | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [busy, setBusy]     = useState(false)
  const pollRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    return () => { cancelled.current = true; if (pollRef.current) clearTimeout(pollRef.current) }
  }, [])

  async function poll(id: string) {
    try {
      const res  = await fetch(`/api/playlist/${id}`)
      const data = await res.json()
      if (cancelled.current) return
      if (!res.ok) throw new Error(data.error ?? 'Lost track of the playlist job')
      setStatus(data)
      if (data.status === 'error') { setError(data.error); setBusy(false); return }
      if (data.status === 'done')  { setBusy(false); return }
      pollRef.current = setTimeout(() => poll(id), 2000)
    } catch (e) {
      if (cancelled.current) return
      setError(e instanceof Error ? e.message : 'Lost track of the playlist job')
      setBusy(false)
    }
  }

  async function start() {
    setError(null); setStatus(null); setJobId(null); setBusy(true)
    try {
      const res = source === 'link'
        ? await fetch('/api/playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, lang }),
          })
        : await fetch('/api/playlist', { method: 'POST', body: (() => {
            const f = new FormData(); f.append('file', zip!); f.append('lang', lang); return f
          })() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not start the job')
      setJobId(data.id)
      poll(data.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the job')
      setBusy(false)
    }
  }

  const doneCount = status?.songs.filter(s => s.state === 'done').length ?? 0
  const ready = source === 'link' ? url.trim().length > 8 : !!zip

  return (
    <div>
      <div className="flex gap-2 mb-3 bg-gray-900 p-1 rounded-lg border border-gray-800 text-xs">
        {([['link', 'YouTube / YouTube Music link'], ['zip', 'Zip of MP3s']] as [Source, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSource(k)}
            disabled={busy}
            className={`flex-1 py-2 rounded-md font-semibold transition ${
              source === k ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {source === 'link' ? (
        <>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={busy}
            placeholder="https://music.youtube.com/playlist?list=…"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">
            Playlist must be public (or unlisted), up to 50 songs. Spotify links can&apos;t be fetched
            (DRM) — export your songs as MP3s and use the zip option. Downloading from YouTube may
            breach its terms; only use content you&apos;re entitled to.
          </p>
        </>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-32 bg-gray-900 border border-dashed border-gray-700 hover:border-blue-500 rounded-xl cursor-pointer transition text-center px-6">
          <span className="text-gray-300 text-sm font-semibold break-all">{zip ? zip.name : 'Choose a .zip of audio files'}</span>
          <span className="text-xs text-gray-600 mt-1">
            {zip ? `${(zip.size / 1024 / 1024).toFixed(1)} MB` : 'Songs are numbered in filename order. Max 50 songs / 1 GB.'}
          </span>
          <input type="file" accept=".zip,application/zip" className="hidden" disabled={busy}
                 onChange={e => setZip(e.target.files?.[0] ?? null)} />
        </label>
      )}

      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

      <button
        onClick={start}
        disabled={!ready || busy}
        className="w-full mt-4 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-lg transition"
      >
        {busy ? 'Working…' : `Transcribe ${LANGUAGE_NAMES[lang]} playlist →`}
      </button>

      {status && status.songs.length > 0 && (
        <div className="mt-5 bg-gray-900 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-3">
            {doneCount} / {status.songs.length} songs done. Transcribing runs on the CPU, so long playlists take a while —
            you can leave this page open and come back.
          </p>
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {status.songs.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 w-9 shrink-0 font-mono">{s.id}</span>
                <span className="flex-1 truncate text-gray-300" title={s.error ?? s.title}>{s.title}</span>
                <span className={`text-xs shrink-0 ${
                  s.state === 'done' ? 'text-green-400' : s.state === 'error' ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {s.state === 'transcribing' ? `${Math.round(s.progress * 100)}%` : STATE_LABEL[s.state]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {jobId && doneCount > 0 && (
        <a
          href={`/api/playlist/${jobId}/export?lang=${lang}`}
          className="block text-center w-full mt-4 py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-lg transition"
        >
          Download playlist ({doneCount} {doneCount === 1 ? 'song' : 'songs'}) ↓
        </a>
      )}
    </div>
  )
}
