// Word Testing page — flashcard-style sessions with 4-option multiple choice.
//
// Flow: Selection phase (4 rounds × 4 words) → Verification phase (type the answer).
// The microphone button uses the Web Speech API to fill in typed answers by voice.
// Knowledge levels are updated after each round: correct → level up, wrong → level down.
// Words are drawn weighted by knowledge level so weaker words appear more often.
//
// Direction:
//   Normal   (source=en): see foreign word → type English   (e.g. "pergi" → "to go")
//   Reversed (source=id): see English word → type foreign   (e.g. "to go" → "pergi")

'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Word, checkTranslation, checkReverseTranslation } from '@/lib/words'
import { wordsFor } from '@/lib/language-data'
import { Language, LANGUAGE_NAMES, LANGUAGE_FLAGS, SourceLanguage } from '@/lib/language'
import {
  fetchKnowledge, saveKnowledge, bulkSetLevel,
  KnowledgeBase, KnowledgeLevel, levelLabel, levelColor,
} from '@/lib/knowledge'

const WORDS_PER_ROUND = 4
const SELECTION_ROUNDS = 4
const VERIFY_COUNT = 5

type Phase = 'loading' | 'selection' | 'verification' | 'complete'

interface RoundResult {
  wordId: string
  claimed: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function wordListFor(lang: Language): Word[] {
  return wordsFor(lang)
}

function pickWords(lang: Language, exclude: Set<string>, count: number): Word[] {
  return shuffle(wordListFor(lang).filter(w => !exclude.has(w.id))).slice(0, count)
}

function TestingInner() {
  const searchParams = useSearchParams()
  const lang       = (searchParams.get('lang')    ?? 'es') as Language
  const source     = (searchParams.get('source')  ?? 'en') as SourceLanguage
  const isReversed = source !== 'en'  // Indonesian speaker → English target

  const [kb, setKb] = useState<KnowledgeBase | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [round, setRound] = useState(1)
  const [roundWords, setRoundWords] = useState<Word[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set())
  const [claimed, setClaimed] = useState<Word[]>([])
  const [results, setResults] = useState<RoundResult[]>([])
  const [verifyQueue, setVerifyQueue] = useState<Word[]>([])
  const [verifyIdx, setVerifyIdx] = useState(0)
  const [verifyOutcomes, setVerifyOutcomes] = useState<Map<string, boolean>>(new Map())
  const [inputVal, setInputVal] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [summary, setSummary] = useState<{ level: KnowledgeLevel; words: Word[] }[]>([])
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    fetchKnowledge(lang, source).then(loaded => {
      if (cancelled) return
      setKb(loaded)
      const initial = pickWords(lang, new Set(), WORDS_PER_ROUND)
      setRoundWords(initial)
      setUsedIds(new Set(initial.map(w => w.id)))
      setSelected(new Set())
      setRound(1)
      setClaimed([])
      setResults([])
      setVerifyIdx(0)
      setVerifyOutcomes(new Map())
      setInputVal('')
      setPhase('selection')
    })
    return () => { cancelled = true }
  }, [lang])

  function toggleWord(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function submitRound() {
    const roundResults: RoundResult[] = roundWords.map(w => ({
      wordId: w.id,
      claimed: selected.has(w.id),
    }))
    const newClaimed = [...claimed, ...roundWords.filter(w => selected.has(w.id))]
    const allResults = [...results, ...roundResults]

    if (round < SELECTION_ROUNDS) {
      const nextWords = pickWords(lang, usedIds, WORDS_PER_ROUND)
      setRoundWords(nextWords)
      setUsedIds(prev => new Set([...prev, ...nextWords.map(w => w.id)]))
      setSelected(new Set())
      setRound(r => r + 1)
      setClaimed(newClaimed)
      setResults(allResults)
    } else {
      const toVerify = shuffle(newClaimed).slice(0, VERIFY_COUNT)
      setClaimed(newClaimed)
      setResults(allResults)
      setVerifyQueue(toVerify)
      setVerifyIdx(0)
      setVerifyOutcomes(new Map())
      setPhase('verification')
    }
  }

  function submitVerification() {
    if (feedback) return
    const word = verifyQueue[verifyIdx]
    const correct = isReversed ? checkReverseTranslation(word, inputVal) : checkTranslation(word, inputVal)
    setFeedback(correct ? 'correct' : 'wrong')

    const nextOutcomes = new Map(verifyOutcomes)
    nextOutcomes.set(word.id, correct)
    setVerifyOutcomes(nextOutcomes)

    setTimeout(() => {
      setFeedback(null)
      setInputVal('')
      if (verifyIdx + 1 >= verifyQueue.length) {
        finalize(nextOutcomes)
      } else {
        setVerifyIdx(i => i + 1)
      }
    }, 900)
  }

  function finalize(outcomes: Map<string, boolean>) {
    const verifiedIds = new Set(verifyQueue.map(w => w.id))
    const updates: { wordId: string; level: KnowledgeLevel }[] = results.map(r => {
      if (!r.claimed) return { wordId: r.wordId, level: 2 }
      if (verifiedIds.has(r.wordId)) return { wordId: r.wordId, level: outcomes.get(r.wordId) ? 4 : 2 }
      return { wordId: r.wordId, level: 3 }
    })

    const newKb = bulkSetLevel(kb!, updates)
    saveKnowledge(newKb, lang, source)  // fire-and-forget async save
    setKb(newKb)

    const allWords = wordListFor(lang)
    const byLevel = new Map<KnowledgeLevel, Word[]>()
    for (const u of updates) {
      const word = allWords.find(w => w.id === u.wordId)!
      byLevel.set(u.level, [...(byLevel.get(u.level) ?? []), word])
    }
    setSummary(
      ([4, 3, 2] as KnowledgeLevel[])
        .filter(l => byLevel.has(l))
        .map(l => ({ level: l, words: byLevel.get(l)! }))
    )
    setPhase('complete')
  }

  function startListening() {
    const SR = (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    if (recognitionRef.current) recognitionRef.current.abort()
    const r = new SR()
    r.lang = 'en-US'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onstart  = () => setListening(true)
    r.onend    = () => setListening(false)
    r.onerror  = () => setListening(false)
    r.lang = isReversed ? 'id-ID' : 'en-US'
    r.onresult = e => {
      const text = e.results[0][0].transcript
      setInputVal(text)
    }
    recognitionRef.current = r
    r.start()
  }

  function resetSession() {
    const initial = pickWords(lang, new Set(), WORDS_PER_ROUND)
    setRoundWords(initial)
    setUsedIds(new Set(initial.map(w => w.id)))
    setSelected(new Set())
    setRound(1)
    setClaimed([])
    setResults([])
    setVerifyIdx(0)
    setVerifyOutcomes(new Map())
    setInputVal('')
    setPhase('selection')
  }

  if (phase === 'loading') {
    return <div className="min-h-screen bg-gray-950" />
  }

  if (phase === 'selection') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Link href="/" className="text-white hover:text-gray-300 transition" aria-label="Home">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                </Link>
                <h1 className="text-xl font-semibold text-gray-100">
                  {LANGUAGE_FLAGS[lang]} {LANGUAGE_NAMES[lang]} · Word Testing
                </h1>
              </div>
              <span className="text-sm text-gray-500">Round {round} of {SELECTION_ROUNDS}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${((round - 1) / SELECTION_ROUNDS) * 100}%` }}
              />
            </div>
            <p className="mt-4 text-gray-400 text-sm">
              Click the words you <span className="text-white font-medium">think you know</span>. You&apos;ll verify later.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {roundWords.map(word => {
              const isSelected = selected.has(word.id)
              return (
                <button
                  key={word.id}
                  onClick={() => toggleWord(word.id)}
                  className={`rounded-xl p-6 text-center border-2 transition-all duration-150 ${
                    isSelected
                      ? 'bg-blue-600 border-blue-400 text-white scale-[1.02]'
                      : 'bg-gray-900 border-gray-700 text-gray-200 hover:border-gray-500 hover:bg-gray-800'
                  }`}
                >
                  {isReversed ? (
                    // Reversed: show the English word (what the user is learning)
                    <>
                      <span className="text-2xl font-bold tracking-wide">{word.english}</span>
                      <div className="mt-1 text-sm text-gray-500">{word.word}</div>
                    </>
                  ) : (
                    // Normal: show the foreign word
                    <>
                      <span className="text-2xl font-bold tracking-wide">{word.word}</span>
                      {word.characters && (
                        <div className="mt-1 text-base text-gray-400">{word.characters}</div>
                      )}
                    </>
                  )}
                  <div className="mt-1 text-xs text-gray-500 capitalize">{word.pos}</div>
                </button>
              )
            })}
          </div>

          <p className="text-xs text-gray-600 text-center mb-6">
            Blue = I think I know this &nbsp;·&nbsp; Gray = I don&apos;t know this
          </p>

          <button
            onClick={submitRound}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition"
          >
            {round < SELECTION_ROUNDS ? 'Next Round →' : 'Start Verification →'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'verification') {
    const word = verifyQueue[verifyIdx]
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-semibold text-gray-100">Verification</h1>
              <span className="text-sm text-gray-500">{verifyIdx + 1} of {verifyQueue.length}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(verifyIdx / verifyQueue.length) * 100}%` }}
              />
            </div>
            <p className="mt-4 text-gray-400 text-sm">
              You said you knew these. Type the {isReversed ? LANGUAGE_NAMES[lang] : 'English'} translation.
            </p>
          </div>

          <div className={`rounded-2xl p-10 text-center mb-6 border-2 transition-colors duration-300 ${
            feedback === 'correct' ? 'bg-green-900 border-green-500' :
            feedback === 'wrong'   ? 'bg-red-900 border-red-500' :
                                     'bg-gray-900 border-gray-700'
          }`}>
            {isReversed ? (
              // Reversed: prompt is English, answer is foreign
              <>
                <div className="text-4xl font-bold mb-1">{word.english}</div>
                <div className="text-sm text-gray-500 capitalize">{word.pos}</div>
              </>
            ) : (
              // Normal: prompt is foreign, answer is English
              <>
                <div className="text-4xl font-bold mb-1">{word.word}</div>
                {word.characters && (
                  <div className="text-2xl text-gray-400 mb-1">{word.characters}</div>
                )}
                <div className="text-sm text-gray-500 capitalize">{word.pos}</div>
              </>
            )}
            {feedback && (
              <div className={`mt-4 text-sm font-medium ${feedback === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                {feedback === 'correct'
                  ? '✓ Correct!'
                  : `✗ Answer: ${isReversed ? word.word : word.english}`}
              </div>
            )}
          </div>

          {!feedback && (
            <div className="flex gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && inputVal.trim() && submitVerification()}
                placeholder={isReversed ? `${LANGUAGE_NAMES[lang]} translation…` : 'English translation…'}
                autoFocus
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={startListening}
                title="Speak your answer"
                className={`px-3 py-3 rounded-xl border transition flex items-center justify-center ${
                  listening
                    ? 'bg-red-600 border-red-500 text-white animate-pulse'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/>
                </svg>
              </button>
              <button
                onClick={submitVerification}
                disabled={!inputVal.trim()}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition"
              >
                Check
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Complete
  const known    = summary.find(s => s.level === 4)?.words.length ?? 0
  const familiar = summary.find(s => s.level === 3)?.words.length ?? 0
  const seen     = summary.find(s => s.level === 2)?.words.length ?? 0

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">✓</div>
          <h1 className="text-2xl font-bold mb-2">Session Complete</h1>
          <p className="text-gray-400 text-sm">{results.length} words tested · {LANGUAGE_FLAGS[lang]} {LANGUAGE_NAMES[lang]}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Known',    count: known,    color: '#22c55e' },
            { label: 'Familiar', count: familiar, color: '#f59e0b' },
            { label: 'Seen',     count: seen,     color: '#ef4444' },
          ].map(({ label, count, color }) => (
            <div key={label} className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
              <div className="text-2xl font-bold" style={{ color }}>{count}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {summary.map(({ level, words }) => (
          <div key={level} className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: levelColor(level) }}>
              {levelLabel(level)}
            </div>
            <div className="flex flex-wrap gap-2">
              {words.map(w => (
                <span key={w.id} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm">
                  <span className="font-medium">{w.word}</span>
                  {w.characters && <span className="text-gray-500 ml-1">{w.characters}</span>}
                  <span className="text-gray-500 ml-1.5">· {w.english}</span>
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-3 mt-8">
          <button
            onClick={resetSession}
            className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold transition"
          >
            Test Again
          </button>
          <Link
            href="/vocab-graph"
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-center transition"
          >
            View Graph →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function TestingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <TestingInner />
    </Suspense>
  )
}
