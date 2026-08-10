'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Language, LANGUAGE_NAMES, LANGUAGE_FLAGS, getStoredLanguage, setStoredLanguage,
  SourceLanguage, SOURCE_LANGUAGE_NAMES, SOURCE_LANGUAGE_FLAGS,
  getStoredSourceLanguage, setStoredSourceLanguage,
} from '@/lib/language'
import { getSettings, saveSettings } from '@/lib/settings'

// ── Language pair config ──────────────────────────────────────────────────────

const SOURCE_OPTIONS: { code: SourceLanguage; name: string; flag: string }[] = [
  { code: 'en', name: SOURCE_LANGUAGE_NAMES.en, flag: SOURCE_LANGUAGE_FLAGS.en },
  { code: 'id', name: SOURCE_LANGUAGE_NAMES.id, flag: SOURCE_LANGUAGE_FLAGS.id },
]

// All possible target languages (includes English for non-English speakers)
const TARGET_OPTIONS: { code: string; name: string; flag: string }[] = [
  { code: 'en', name: 'English',    flag: '🇬🇧' },
  { code: 'es', name: LANGUAGE_NAMES.es, flag: LANGUAGE_FLAGS.es },
  { code: 'zh', name: LANGUAGE_NAMES.zh, flag: LANGUAGE_FLAGS.zh },
  { code: 'id', name: LANGUAGE_NAMES.id, flag: LANGUAGE_FLAGS.id },
]

// Is a given target selectable for a given source?
// Rules:
//   - Can't study your own language (e.g. English → English)
//   - Indonesian source only supports English target (the only available pair)
function isTargetAvailable(targetCode: string, source: SourceLanguage): boolean {
  if (targetCode === source) return false
  if (source === 'id' && targetCode !== 'en') return false
  return true
}

// Which Language (word-list key) to use for a source+target pair.
// When target is English, the Indonesian word list is used in reversed direction.
function langFor(source: SourceLanguage, target: string): Language {
  if (target === 'en') return 'id'
  return target as Language
}

// First valid target for a given source
function defaultTarget(source: SourceLanguage): string {
  return TARGET_OPTIONS.find(t => isTargetAvailable(t.code, source))!.code
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [source, setSource]       = useState<SourceLanguage>('en')
  const [target, setTarget]       = useState<string>('id')
  const [familiarity, setFamiliarity] = useState(70)

  useEffect(() => {
    const s = getStoredSourceLanguage()
    const l = getStoredLanguage()  // stored as the word-list lang ('es','zh','id')

    setSource(s)
    setFamiliarity(getSettings().familiarity)

    if (s === 'id') {
      // Indonesian source always maps to English target in the UI
      setTarget('en')
    } else {
      setTarget(l)
    }
  }, [])

  function selectSource(s: SourceLanguage) {
    setSource(s)
    setStoredSourceLanguage(s)
    // If current target is no longer valid for the new source, pick a valid one
    if (!isTargetAvailable(target, s)) {
      const t = defaultTarget(s)
      setTarget(t)
      setStoredLanguage(langFor(s, t))
    }
  }

  function selectTarget(t: string) {
    setTarget(t)
    setStoredLanguage(langFor(source, t))
  }

  function updateFamiliarity(v: number) {
    setFamiliarity(v)
    saveSettings({ familiarity: v })
  }

  const lang = langFor(source, target)
  // source param lets game pages know the direction (reversed when source='id')
  const params = `lang=${lang}&source=${source}`

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold mb-2">Language Learning</h1>
        <p className="text-gray-500 text-sm mb-8">Build your vocabulary, one word at a time.</p>

        {/* Source language — what the user already speaks */}
        <div className="mb-2 text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">I speak</span>
        </div>
        <div className="flex gap-2 mb-5 bg-gray-900 p-1 rounded-xl border border-gray-800">
          {SOURCE_OPTIONS.map(s => (
            <button
              key={s.code}
              onClick={() => selectSource(s.code)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                source === s.code
                  ? 'bg-gray-700 text-white shadow'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s.flag} {s.name}
            </button>
          ))}
        </div>

        {/* Target language — what the user wants to learn */}
        <div className="mb-2 text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">I want to learn</span>
        </div>
        <div className="flex gap-1.5 mb-8 bg-gray-900 p-1 rounded-xl border border-gray-800">
          {TARGET_OPTIONS.map(t => {
            const available = isTargetAvailable(t.code, source)
            const active    = target === t.code
            return (
              <button
                key={t.code}
                onClick={() => available && selectTarget(t.code)}
                disabled={!available}
                title={!available ? (t.code === source ? "Same as source language" : "No word data for this pair yet") : undefined}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  !available
                    ? 'text-gray-700 cursor-not-allowed'
                    : active
                      ? 'bg-gray-700 text-white shadow'
                      : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t.flag} {t.name}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 mb-8">
          <Link
            href={`/testing?${params}`}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-lg transition"
          >
            Word Testing
          </Link>
          <Link
            href={`/sentence-game?${params}`}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg transition"
          >
            Sentence Game
          </Link>
          <Link
            href="/load-text"
            className="w-full py-4 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-semibold text-lg transition"
          >
            Load Text
          </Link>
          <Link
            href="/vocab-graph"
            className="w-full py-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-lg transition"
          >
            Vocabulary Graph
          </Link>
          <Link
            href="/knowledge"
            className="w-full py-3 rounded-xl border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-gray-200 font-medium text-sm transition text-center"
          >
            Manage Knowledge Graphs
          </Link>
        </div>

        {/* Settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-left">
          <div className="flex items-center gap-2 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-500">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.01 7.01 0 0 0-1.62-.94l-.36-2.54A.484.484 0 0 0 14 2h-4a.484.484 0 0 0-.48.41l-.36 2.54a7.37 7.37 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.05.24.27.41.49.41h4c.22 0 .43-.17.47-.41l.36-2.54a7.37 7.37 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Settings</span>
          </div>

          {/* Familiarity slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-300 font-medium">Word Familiarity</span>
              <span className="text-sm font-bold text-indigo-400">{familiarity}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={familiarity}
              onChange={e => updateFamiliarity(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-indigo-500 bg-gray-700"
            />
            <div className="flex justify-between mt-1.5 text-xs text-gray-600">
              <span>Mostly new words</span>
              <span>Mostly known words</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
