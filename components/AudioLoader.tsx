// AudioLoader — upload an audio file, transcribe it locally (Whisper), and review the result.
//
// Three internal steps: pick file → transcribing (polls /api/transcribe/[id]) → review.
// In review the user can fix mis-heard lyrics, delete junk lines, and preview each line
// against the audio before handing the segments to Load Text via onReady.

'use client'

import { useEffect, useRef, useState } from 'react'
import { Language, LANGUAGE_NAMES } from '@/lib/language'
import type { Segment, TranscribeStatus } from '@/lib/transcribe-jobs'

interface Props {
  lang: Language
  onReady: (file: File, segments: Segment[]) => void
}

type Step = 'pick' | 'transcribing' | 'review'

function fmt(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function AudioLoader({ lang, onReady }: Props) {
  const [step, setStep]         = useState<Step>('pick')
  const [file, setFile]         = useState<File | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [status, setStatus]     = useState<TranscribeStatus | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioRef  = useRef<HTMLAudioElement>(null)
  const stopAtRef = useRef<number | null>(null)
  const pollRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  // Object URL for previewing lines during review; revoked when the file changes/unmounts.
  useEffect(() => {
    if (!file) { setAudioUrl(null); return }
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function poll(id: string) {
    try {
      const res  = await fetch(`/api/transcribe/${id}`)
      const data = await res.json() as TranscribeStatus & { error: string | null }
      if (cancelled.current) return
      if (!res.ok) throw new Error(data.error ?? 'Lost track of the transcription job')
      setStatus(data)
      if (data.status === 'error') { setError(data.error ?? 'Transcription failed'); setStep('pick'); return }
      if (data.status === 'done') {
        if (data.segments.length === 0) {
          setError('No speech or singing was detected in that file.')
          setStep('pick')
        } else {
          setSegments(data.segments)
          setStep('review')
        }
        return
      }
      pollRef.current = setTimeout(() => poll(id), 1000)
    } catch (e) {
      if (cancelled.current) return
      setError(e instanceof Error ? e.message : 'Transcription failed')
      setStep('pick')
    }
  }

  async function startTranscribe() {
    if (!file) return
    setError(null)
    setStatus(null)
    setStep('transcribing')
    const body = new FormData()
    body.append('file', file)
    body.append('lang', lang)
    try {
      const res  = await fetch('/api/transcribe', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      poll(data.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setStep('pick')
    }
  }

  function playLine(seg: Segment) {
    const a = audioRef.current
    if (!a) return
    a.currentTime = seg.start
    stopAtRef.current = seg.end
    a.play()
  }

  function editText(i: number, text: string) {
    setSegments(segs => segs.map((s, j) => (j === i ? { ...s, text } : s)))
  }

  function finish() {
    const cleaned = segments.map(s => ({ ...s, text: s.text.trim() })).filter(s => s.text)
    if (file && cleaned.length) onReady(file, cleaned)
  }

  // ── PICK ────────────────────────────────────────────────────────────────────
  if (step === 'pick') {
    return (
      <div>
        <label className="flex flex-col items-center justify-center w-full h-64 bg-gray-900 border border-dashed border-gray-700 hover:border-blue-500 rounded-xl cursor-pointer transition text-center px-6">
          <span className="text-4xl mb-3">🎵</span>
          {file ? (
            <>
              <span className="text-gray-200 text-sm font-semibold break-all">{file.name}</span>
              <span className="text-xs text-gray-600 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB — click to choose a different file</span>
            </>
          ) : (
            <>
              <span className="text-gray-300 text-sm font-semibold">Upload an audio file</span>
              <span className="text-xs text-gray-600 mt-2 leading-relaxed">
                MP3 (or WAV, M4A, OGG, FLAC) — songs, podcasts, or clips.
                Transcribed on this machine with Whisper, so nothing leaves your computer.
              </span>
            </>
          )}
          <input
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac"
            className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setError(null) }}
          />
        </label>

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        <button
          onClick={startTranscribe}
          disabled={!file}
          className="w-full mt-4 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-lg transition"
        >
          Transcribe {LANGUAGE_NAMES[lang]} →
        </button>
      </div>
    )
  }

  // ── TRANSCRIBING ────────────────────────────────────────────────────────────
  if (step === 'transcribing') {
    const pct = Math.round((status?.progress ?? 0) * 100)
    const loading = !status || status.status === 'loading'
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <p className="text-sm text-gray-300 mb-1">
          {loading ? 'Loading Whisper model…' : `Transcribing… ${pct}%`}
        </p>
        <p className="text-xs text-gray-600 mb-4">
          {loading
            ? 'The first run downloads the model, which can take a few minutes.'
            : 'This can take a while for long files — it runs on the CPU.'}
        </p>
        <div className="h-1.5 bg-gray-800 rounded-full">
          <div
            className={`h-full bg-blue-500 rounded-full transition-all duration-500 ${loading ? 'animate-pulse' : ''}`}
            style={{ width: loading ? '100%' : `${pct}%`, opacity: loading ? 0.3 : 1 }}
          />
        </div>
        {status && status.segments.length > 0 && (
          <p className="text-xs text-gray-600 mt-4 truncate">
            Latest: {status.segments[status.segments.length - 1].text}
          </p>
        )}
      </div>
    )
  }

  // ── REVIEW ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <p className="text-sm text-gray-400 mb-3">
        Check the transcript — Whisper can mishear lyrics. Edit, delete, or play any line.
      </p>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          className="w-full mb-3"
          onTimeUpdate={e => {
            const stop = stopAtRef.current
            if (stop !== null && e.currentTarget.currentTime >= stop) {
              e.currentTarget.pause()
              stopAtRef.current = null
            }
          }}
          onPause={() => { stopAtRef.current = null }}
        />
      )}

      <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-start gap-2">
            <button
              onClick={() => playLine(seg)}
              className="shrink-0 w-14 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-400 transition"
              aria-label={`Play line ${i + 1}`}
            >
              ▶ {fmt(seg.start)}
            </button>
            <textarea
              value={seg.text}
              onChange={e => editText(i, e.target.value)}
              rows={1}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500 [field-sizing:content]"
            />
            <button
              onClick={() => setSegments(segs => segs.filter((_, j) => j !== i))}
              className="shrink-0 px-2 py-2 text-gray-600 hover:text-red-400 transition"
              aria-label={`Delete line ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={() => { setSegments([]); setStep('pick') }}
          className="px-5 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold transition"
        >
          ← Back
        </button>
        <button
          onClick={finish}
          disabled={!segments.some(s => s.text.trim())}
          className="flex-1 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-lg transition"
        >
          Looks good →
        </button>
      </div>
    </div>
  )
}
