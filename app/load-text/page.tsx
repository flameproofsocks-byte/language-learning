// Load Text — paste any foreign-language text and click words to look them up.
//
// Words are split by whitespace and punctuation. Clicking a word checks the built-in
// word list first (instant), then falls back to /api/translate (Google Translate proxy).
// Unknown words can be added to the user's knowledge base at level 1 (Seen).
// Supports Spanish, Mandarin, and Indonesian. Language is persisted via localStorage.

'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Language, LANGUAGE_NAMES, LANGUAGE_FLAGS, getStoredLanguage, setStoredLanguage } from '@/lib/language'
import { Word } from '@/lib/words'
import { wordsFor } from '@/lib/language-data'

// ── Text processing ───────────────────────────────────────────────────────────

function parseSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace/newline,
  // or on blank lines / single newlines between chunks.
  return text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 1)
}

function tokenize(sentence: string, lang: Language): string[] {
  // Chinese characters: split char-by-char so each glyph is clickable
  if (lang === 'zh' && /[一-鿿]/.test(sentence)) {
    // Group into runs of Chinese vs non-Chinese (spaces, pinyin, punctuation)
    const tokens: string[] = []
    let current = ''
    let inChinese = false
    for (const ch of sentence) {
      const isChinese = /[一-鿿]/.test(ch)
      if (ch === ' ' || ch === '\t') {
        if (current) { tokens.push(current); current = '' }
      } else if (isChinese !== inChinese && current) {
        tokens.push(current)
        current = ch
        inChinese = isChinese
      } else {
        current += ch
        inChinese = isChinese
      }
    }
    if (current) tokens.push(current)
    return tokens.filter(t => t.trim().length > 0)
  }
  // Default: split by whitespace
  return sentence.split(/\s+/).filter(t => t.length > 0)
}

interface Hint {
  token: string; clean: string; meaning: string | null
  pinyin?: string; characters?: string; fromApi?: boolean
}

async function fetchTranslation(word: string, lang: Language): Promise<string | null> {
  try {
    const res  = await fetch(`/api/translate?word=${encodeURIComponent(word)}&lang=${lang}`)
    const data = await res.json()
    return data.translation ?? null
  } catch {
    return null
  }
}

function lookupToken(token: string, lang: Language): Hint {
  const list = wordsFor(lang)
  const clean = token.replace(/[.,!?;:¿¡"'()[\]。，！？：；…—–]/g, '').toLowerCase().trim()

  if (!clean) return { token, clean, meaning: null }

  // 1. Exact match on word/pinyin field
  let match = list.find(w => w.word.toLowerCase() === clean)

  // 2. Match on Chinese characters field
  if (!match && lang === 'zh') {
    match = list.find(w => w.characters === token || w.characters === clean)
  }

  // 3. Partial match for compound Chinese (e.g. "不" inside "不客气")
  if (!match && lang === 'zh' && clean.length === 1) {
    match = list.find(w => w.characters === clean)
  }

  if (match) {
    return {
      token,
      clean,
      meaning: match.english,
      pinyin: lang === 'zh' ? match.word : undefined,
      characters: lang === 'zh' ? match.characters : undefined,
    }
  }
  return { token, clean, meaning: null }
}

// ── Similarity scoring ────────────────────────────────────────────────────────

function wordSimilarity(a: string, b: string): number {
  const clean = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
  const wa = new Set(clean(a))
  const wb = new Set(clean(b))
  const intersection = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return union === 0 ? 0 : intersection / union
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 0.6) return { label: 'Great match!',  color: 'text-green-400' }
  if (score >= 0.3) return { label: 'Close!',        color: 'text-yellow-400' }
  return                    { label: 'Keep trying',  color: 'text-red-400' }
}

// ── Component ─────────────────────────────────────────────────────────────────

type Phase = 'input' | 'reading'

export default function LoadTextPage() {
  const [lang, setLang]           = useState<Language>('es')
  const [rawText, setRawText]     = useState('')
  const [phase, setPhase]         = useState<Phase>('input')
  const [sentences, setSentences] = useState<string[]>([])
  const [idx, setIdx]             = useState(0)
  const [translation, setTranslation] = useState('')
  const [hint, setHint]           = useState<Hint | null>(null)
  const [hintLoading, setHintLoading]     = useState(false)
  const [revealed, setRevealed]           = useState(false)
  const [actualTranslation, setActualTranslation] = useState<string | null>(null)
  const [actualLoading, setActualLoading] = useState(false)
  const cacheRef = useRef<Map<string, string>>(new Map())
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setLang(getStoredLanguage()) }, [])

  function changeLang(l: Language) {
    setLang(l)
    setStoredLanguage(l)
  }

  function startReading() {
    const parsed = parseSentences(rawText.trim())
    if (parsed.length === 0) return
    setSentences(parsed)
    setIdx(0)
    setTranslation('')
    setHint(null)
    setPhase('reading')
  }

  function resetSentence() {
    setTranslation('')
    setHint(null)
    setHintLoading(false)
    setRevealed(false)
    setActualTranslation(null)
  }

  function goNext() {
    const next = idx + 1
    if (next >= sentences.length) { setPhase('input'); return }
    setIdx(next)
    resetSentence()
  }

  function goBack() {
    if (idx === 0) return
    setIdx(i => i - 1)
    resetSentence()
  }

  async function handleContinue() {
    if (revealed) { goNext(); return }

    // Fetch the actual translation of the full sentence
    const sentence = sentences[idx]
    const cacheKey = `sentence:${lang}:${sentence}`
    setActualLoading(true)
    setRevealed(true)

    if (cacheRef.current.has(cacheKey)) {
      setActualTranslation(cacheRef.current.get(cacheKey)!)
      setActualLoading(false)
      return
    }

    const result = await fetchTranslation(sentence, lang)
    setActualLoading(false)
    if (result) {
      cacheRef.current.set(cacheKey, result)
      setActualTranslation(result)
    }
  }

  async function clickWord(token: string) {
    const local = lookupToken(token, lang)

    if (local.meaning) {
      setHint(local)
      return
    }

    // Not in local vocab — try API
    const clean = local.clean
    if (!clean) return

    const cacheKey = `${lang}:${clean}`
    if (cacheRef.current.has(cacheKey)) {
      setHint({ ...local, meaning: cacheRef.current.get(cacheKey)!, fromApi: true })
      return
    }

    setHint({ ...local, meaning: null })
    setHintLoading(true)
    const result = await fetchTranslation(clean, lang)
    setHintLoading(false)

    if (result) {
      cacheRef.current.set(cacheKey, result)
      setHint({ ...local, meaning: result, fromApi: true })
    } else {
      setHint({ ...local, meaning: null })
    }
  }

  // ── INPUT SCREEN ─────────────────────────────────────────────────────────────
  if (phase === 'input') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-lg">

          <div className="flex items-center gap-3 mb-8">
            <Link href="/" className="text-white hover:text-gray-300 transition" aria-label="Home">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </Link>
            <h1 className="text-2xl font-bold">Load Text</h1>
          </div>

          {/* Language selector */}
          <div className="flex gap-2 mb-5 bg-gray-900 p-1 rounded-xl border border-gray-800">
            {(['es', 'zh', 'id'] as Language[]).map(l => (
              <button
                key={l}
                onClick={() => changeLang(l)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  lang === l ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {LANGUAGE_FLAGS[l]} {LANGUAGE_NAMES[l]}
              </button>
            ))}
          </div>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder={`Paste ${LANGUAGE_NAMES[lang]} text here…\n\nWorks with YouTube transcripts, articles, or any text. Sentences are split by periods, exclamation marks, question marks, or new lines.`}
            className="w-full h-64 bg-gray-900 border border-gray-700 rounded-xl p-4 text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500 text-sm leading-relaxed"
          />

          {rawText.trim().length > 0 && (
            <p className="text-xs text-gray-600 mt-2 mb-3">
              ~{parseSentences(rawText.trim()).length} sentences detected
            </p>
          )}

          <button
            onClick={startReading}
            disabled={rawText.trim().length < 3}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-lg transition"
          >
            Start Reading →
          </button>
        </div>
      </div>
    )
  }

  // ── READING SCREEN ────────────────────────────────────────────────────────────
  const sentence = sentences[idx]
  const tokens   = tokenize(sentence, lang)
  const progress = ((idx + 1) / sentences.length) * 100

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white hover:text-gray-300 transition" aria-label="Home">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </Link>
            <h1 className="text-lg font-semibold">
              {LANGUAGE_FLAGS[lang]} Text Reader
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{idx + 1} / {sentences.length}</span>
            <button
              onClick={() => { setPhase('input'); setHint(null) }}
              className="text-xs text-gray-600 hover:text-gray-400 transition underline"
            >
              Load new text
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800 rounded-full mb-6">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Sentence display */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
            {LANGUAGE_FLAGS[lang]} {LANGUAGE_NAMES[lang]} — click any word for a hint
          </p>
          <div className="flex flex-wrap gap-x-2 gap-y-2 leading-relaxed">
            {tokens.map((token, i) => {
              const isPunct = /^[.,!?;:¿¡"'()[\]。，！？：；…—–]+$/.test(token)
              const isSelected = hint?.token === token && hint?.clean === token.replace(/[.,!?;:¿¡"'()[\]。，！？：；…—–]/g, '').toLowerCase()
              return isPunct ? (
                <span key={i} className="text-xl text-gray-500">{token}</span>
              ) : (
                <button
                  key={i}
                  onClick={() => clickWord(token)}
                  className={`text-xl font-semibold transition rounded px-0.5 ${
                    isSelected
                      ? 'text-blue-300 bg-blue-900/40'
                      : 'text-white hover:text-blue-400 hover:bg-gray-800'
                  }`}
                >
                  {token}
                </button>
              )
            })}
          </div>
        </div>

        {/* Word hint panel */}
        <div className={`rounded-xl border px-4 py-3 mb-5 transition-all ${
          hint ? 'border-gray-700 bg-gray-900' : 'border-transparent bg-transparent'
        }`}>
          {hint ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-base font-bold text-blue-300">{hint.token}</span>
              {hint.pinyin && <span className="text-sm text-gray-500">{hint.pinyin}</span>}
              {hint.characters && hint.characters !== hint.token && (
                <span className="text-sm text-gray-500">{hint.characters}</span>
              )}
              <span className="text-gray-600">→</span>
              {hintLoading ? (
                <span className="text-sm text-gray-500 animate-pulse">looking up…</span>
              ) : hint.meaning ? (
                <div className="flex items-center gap-2">
                  <span className="text-base text-gray-200">{hint.meaning}</span>
                  {hint.fromApi && (
                    <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">API</span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-gray-600 italic">no translation found</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-700 italic">Click a word above to see its translation</p>
          )}
        </div>

        {/* Translation input */}
        <div className="mb-4">
          <label className="text-sm text-gray-500 mb-2 block">Your English translation</label>
          <textarea
            value={translation}
            onChange={e => setTranslation(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleContinue() } }}
            placeholder="Type your translation here, then press Continue…"
            readOnly={revealed}
            rows={3}
            className={`w-full bg-gray-900 border rounded-xl p-4 text-gray-200 placeholder-gray-600 resize-none focus:outline-none text-sm transition-colors ${
              revealed ? 'border-gray-800 opacity-70' : 'border-gray-700 focus:border-blue-500'
            }`}
          />
        </div>

        {/* Comparison panel — shown after Continue */}
        {revealed && (
          <div className="mb-5 rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Actual translation</p>
              {actualLoading ? (
                <p className="text-gray-400 text-sm animate-pulse">Fetching translation…</p>
              ) : actualTranslation ? (
                <p className="text-gray-200 text-base">{actualTranslation}</p>
              ) : (
                <p className="text-gray-600 text-sm italic">Could not fetch translation</p>
              )}
            </div>

            {actualTranslation && translation.trim() && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
                {(() => {
                  const score = wordSimilarity(translation, actualTranslation)
                  const { label, color } = scoreLabel(score)
                  return (
                    <>
                      <span className={`text-sm font-semibold ${color}`}>{label}</span>
                      <span className="text-xs text-gray-600">
                        ({Math.round(score * 100)}% word overlap)
                      </span>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={goBack}
            disabled={idx === 0}
            className="px-5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold transition"
          >
            ← Back
          </button>
          <button
            onClick={goNext}
            className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold transition"
          >
            Skip
          </button>
          <button
            onClick={handleContinue}
            disabled={actualLoading}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition"
          >
            {actualLoading
              ? 'Loading…'
              : revealed
              ? (idx + 1 >= sentences.length ? 'Finish ✓' : 'Next →')
              : 'Continue'}
          </button>
        </div>

      </div>
    </div>
  )
}
