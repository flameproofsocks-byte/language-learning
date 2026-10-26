// LyricsPlayer — plays the uploaded audio with a scrolling, time-synced transcript.
//
// The line matching the current playback time is highlighted and kept centred; clicking a
// line seeks to it. English translations load once in the background (POST /api/translate)
// and can be toggled off. "Practice line by line" hands off to the sentence reader.

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Language, LANGUAGE_FLAGS } from '@/lib/language'
import type { Segment } from '@/lib/transcribe-jobs'

interface Props {
  lang: Language
  audioUrl: string
  segments: Segment[]
  onPractice: (startIdx: number) => void
  onExit: () => void
}

export default function LyricsPlayer({ lang, audioUrl, segments, onPractice, onExit }: Props) {
  const [active, setActive]             = useState(-1)
  const [translations, setTranslations] = useState<(string | null)[] | null>(null)
  const [showTranslation, setShowTranslation] = useState(true)
  const [follow, setFollow]             = useState(true)
  const audioRef = useRef<HTMLAudioElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: segments.map(s => s.text), lang }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setTranslations(d.translations ?? []) })
      .catch(() => { if (!cancelled) setTranslations([]) })
    return () => { cancelled = true }
  }, [segments, lang])

  // A line stays "current" through the gap after it until the next line starts.
  const starts = useMemo(() => segments.map(s => s.start), [segments])
  function indexAt(t: number): number {
    let lo = 0, hi = starts.length - 1, found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (starts[mid] <= t + 0.15) { found = mid; lo = mid + 1 } else hi = mid - 1
    }
    return found
  }

  useEffect(() => {
    if (follow && active >= 0) {
      lineRefs.current[active]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [active, follow])

  function seekTo(i: number) {
    const a = audioRef.current
    if (!a) return
    a.currentTime = segments[i].start
    setActive(i)
    a.play()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl flex flex-col h-[calc(100vh-5rem)]">

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">{LANGUAGE_FLAGS[lang]} Lyrics</h1>
          <button onClick={onExit} className="text-xs text-gray-600 hover:text-gray-400 transition underline">
            Load new text
          </button>
        </div>

        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          className="w-full mb-3"
          onTimeUpdate={e => {
            const i = indexAt(e.currentTarget.currentTime)
            setActive(prev => (prev === i ? prev : i))
          }}
        />

        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} />
            Auto-scroll
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showTranslation} onChange={e => setShowTranslation(e.target.checked)} />
            English
          </label>
          {showTranslation && translations === null && (
            <span className="animate-pulse text-gray-600">translating…</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-900 border border-gray-800 rounded-2xl px-5 py-[30vh]">
          {segments.map((seg, i) => (
            <div
              key={i}
              ref={el => { lineRefs.current[i] = el }}
              onClick={() => seekTo(i)}
              className={`py-3 cursor-pointer transition-all ${
                i === active ? 'opacity-100' : 'opacity-40 hover:opacity-70'
              }`}
            >
              <p className={`text-xl font-semibold leading-snug ${i === active ? 'text-blue-300' : 'text-white'}`}>
                {seg.text}
              </p>
              {showTranslation && translations?.[i] && (
                <p className="text-sm text-gray-400 mt-1">{translations[i]}</p>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => onPractice(Math.max(active, 0))}
          className="w-full mt-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition"
        >
          Practice line by line →
        </button>
      </div>
    </div>
  )
}
