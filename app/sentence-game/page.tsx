// Dragon Sentence Game — tap word tiles to rebuild a shuffled sentence.
//
// Sentences are selected based on the familiarity setting: a sentence scores higher
// when more of its answer tokens are words the user already knows (level ≥3).
// HP bars make the game feel like a battle: lose HP for wrong tile picks, gain for correct.
// Knowledge levels are updated on game end: words in correct answers level up by 1.

'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Language, LANGUAGE_NAMES, LANGUAGE_FLAGS, SourceLanguage } from '@/lib/language'
import { sentencesFor, SentenceChallenge } from '@/lib/sentences'
import { Word } from '@/lib/words'
import { wordsFor } from '@/lib/language-data'
import { MANDARIN_WORDS } from '@/lib/mandarin'
import { fetchKnowledge, saveKnowledge, bulkSetLevel, KnowledgeBase, KnowledgeLevel } from '@/lib/knowledge'
import { getSettings } from '@/lib/settings'

// ── Balance config — adjust here for difficulty settings ─────────────────────
const CONFIG = {
  WIZARD_MAX_HP:       100,
  DRAGON_MAX_HP:       100,

  WRONG_DAMAGE:         15,   // wizard HP lost on wrong answer
  DRAGON_DAMAGE:        10,   // dragon HP lost on correct answer (no wager)

  REVEAL_COST:           2,   // HP cost per word revealed
  DISPERSE_COST:         8,   // HP cost to grey out distractors
  WAGER_COST:           10,   // HP cost to activate wager

  WAGER_DRAGON_DAMAGE:  15,   // dragon HP lost on wager win
  WAGER_HEAL:           20,   // wizard HP gained on wager win
}

// ─────────────────────────────────────────────────────────────────────────────

interface Tile { key: string; text: string }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getTranslation(word: string, sentence: SentenceChallenge, lang: Language): string | null {
  if (sentence.hints[word]) return sentence.hints[word]
  const match = wordsFor(lang).find(w => w.word.toLowerCase() === word.toLowerCase())
  if (!match) return null
  if (match.pos === 'article' || match.pos === 'conjunction') return null
  return match.english
}

function getCharacters(word: string): string | null {
  const match = MANDARIN_WORDS.find(w => w.word.toLowerCase() === word.toLowerCase())
  return match?.characters ?? null
}

function sentenceFamiliarityScore(sentence: SentenceChallenge, kb: KnowledgeBase, lang: Language): number {
  const list = wordsFor(lang)
  const scoreable = sentence.answer.filter(word =>
    list.some(w => w.word.toLowerCase() === word.toLowerCase())
  )
  if (scoreable.length === 0) return 0
  const known = scoreable.filter(word => {
    const match = list.find(w => w.word.toLowerCase() === word.toLowerCase())!
    return (kb.words[match.id]?.level ?? 1) >= 3
  })
  return known.length / scoreable.length
}

function orderByFamiliarity(
  sentences: SentenceChallenge[],
  kb: KnowledgeBase,
  lang: Language,
  familiarity: number,  // 0–100
): SentenceChallenge[] {
  const target = familiarity / 100
  return [...sentences]
    .map(s => ({ s, score: sentenceFamiliarityScore(s, kb, lang) + (Math.random() * 0.05) }))
    .sort((a, b) => Math.abs(a.score - target) - Math.abs(b.score - target))
    .map(({ s }) => s)
}

function buildPool(sentence: SentenceChallenge, lang: Language, isReversed: boolean): Tile[] {
  if (isReversed) {
    // Reversed: tiles are English words from the sentence.english prompt
    const tokens = sentence.english.split(/\s+/)
    return shuffle(tokens).map((text, i) => ({ key: `tile-${i}`, text }))
  }
  // Normal: tiles are foreign language words + a few distractors
  const wordList = wordsFor(lang)
  const answerLower = new Set(sentence.answer.map(w => w.toLowerCase()))
  const distractors = shuffle(
    wordList.map(w => w.word).filter(w => !answerLower.has(w.toLowerCase()))
  ).slice(0, 5)
  return shuffle([...sentence.answer, ...distractors]).map((text, i) => ({ key: `tile-${i}`, text }))
}

function HPBar({ current, max, color }: { current: number; max: number; color: 'green' | 'red' }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100))
  return (
    <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color === 'green' ? 'bg-green-500' : 'bg-red-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

type RoundPhase = 'playing' | 'correct' | 'wrong'
type GamePhase  = 'active' | 'won' | 'lost'

function SentenceGameInner() {
  const searchParams = useSearchParams()
  const lang       = (searchParams.get('lang')   ?? 'es') as Language
  const source     = (searchParams.get('source') ?? 'en') as SourceLanguage
  const isReversed = source !== 'en'  // Indonesian source → arrange English tiles

  // Sentence state — ordered after KB loads; plain shuffle until then
  const [sentences, setSentences] = useState<SentenceChallenge[]>(() => shuffle(sentencesFor(lang)))
  const [idx, setIdx] = useState(0)
  const [pool, setPool]     = useState<Tile[]>([])
  const [answer, setAnswer] = useState<Tile[]>([])
  const [phase, setPhase]   = useState<RoundPhase>('playing')
  const [score, setScore]   = useState({ correct: 0, total: 0 })

  // Battle state
  const [wizardHp,  setWizardHp]  = useState(CONFIG.WIZARD_MAX_HP)
  const [dragonHp,  setDragonHp]  = useState(CONFIG.DRAGON_MAX_HP)
  const [gamePhase, setGamePhase] = useState<GamePhase>('active')

  // Knowledge base — also triggers initial sentence ordering
  const [kb, setKb] = useState<KnowledgeBase | null>(null)
  useEffect(() => {
    fetchKnowledge(lang, source).then(loaded => {
      setKb(loaded)
      const { familiarity } = getSettings()
      setSentences(orderByFamiliarity(sentencesFor(lang), loaded, lang, familiarity))
      setIdx(0)
    })
  }, [lang])

  // Session word tracking
  const [sessionKnown,      setSessionKnown]      = useState<Set<string>>(new Set())
  const [sessionFamiliar,   setSessionFamiliar]   = useState<Set<string>>(new Set())
  const [sessionEncountered, setSessionEncountered] = useState<Set<string>>(new Set())

  // Spell state
  const [revealMode,    setRevealMode]    = useState(false)
  const [revealedWords, setRevealedWords] = useState<Set<string>>(new Set())
  const [dispersed,     setDispersed]     = useState(false)
  const [wagerActive,   setWagerActive]   = useState(false)

  // Flash animations
  const [wizardFlash, setWizardFlash] = useState<'damage' | 'heal' | null>(null)
  const [dragonFlash, setDragonFlash] = useState(false)

  const sentence = sentences[idx]

  const resetRound = useCallback(() => {
    const newPool = buildPool(sentence, lang, isReversed)
    setPool(newPool)
    setSessionEncountered(prev => {
      const next = new Set(prev)
      newPool.forEach(t => next.add(t.text))
      sentence.answer.forEach(w => next.add(w))
      return next
    })
    setAnswer([])
    setPhase('playing')
    setRevealMode(false)
    setRevealedWords(new Set())
    setDispersed(false)
    setWagerActive(false)
  }, [sentence, lang])

  useEffect(() => { resetRound() }, [resetRound])

  function triggerFlash(target: 'wizard' | 'dragon', type: 'damage' | 'heal') {
    if (target === 'wizard') {
      setWizardFlash(type)
      setTimeout(() => setWizardFlash(null), 700)
    } else {
      setDragonFlash(true)
      setTimeout(() => setDragonFlash(false), 700)
    }
  }

  function pickFromPool(tile: Tile) {
    if (phase !== 'playing') return

    if (revealMode) {
      const newHp = Math.max(0, wizardHp - CONFIG.REVEAL_COST)
      setWizardHp(newHp)
      triggerFlash('wizard', 'damage')
      setRevealedWords(prev => new Set([...prev, tile.text]))
      setRevealMode(false)
      if (newHp <= 0) setGamePhase('lost')
      return
    }

    setPool(prev => prev.filter(t => t.key !== tile.key))
    setAnswer(prev => [...prev, tile])
  }

  function returnToPool(tile: Tile) {
    if (phase !== 'playing') return
    setAnswer(prev => prev.filter(t => t.key !== tile.key))
    setPool(prev => [...prev, tile])
  }

  function submit() {
    if (answer.length === 0) return
    const correctAnswer = isReversed
      ? sentence.english.split(/\s+/).join(' ')  // English tokens joined
      : sentence.answer.join(' ')                 // Foreign tokens joined
    const correct = answer.map(t => t.text).join(' ') === correctAnswer
    setPhase(correct ? 'correct' : 'wrong')
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))

    if (correct) {
      const damage = wagerActive ? CONFIG.WAGER_DRAGON_DAMAGE : CONFIG.DRAGON_DAMAGE
      const newDragonHp = Math.max(0, dragonHp - damage)
      setDragonHp(newDragonHp)
      setTimeout(() => triggerFlash('dragon', 'damage'), 100)

      if (wagerActive) {
        const newWizardHp = Math.min(CONFIG.WIZARD_MAX_HP, wizardHp + CONFIG.WAGER_HEAL)
        setWizardHp(newWizardHp)
        triggerFlash('wizard', 'heal')
      }

      // Track session known words
      setSessionKnown(prev => {
        const next = new Set(prev)
        sentence.answer.forEach(w => next.add(w))
        return next
      })

      // Add sentence words to the knowledge graph as "Known"
      if (kb) {
        const list = wordsFor(lang)
        const updates = sentence.answer
          .map(word => list.find(w => w.word.toLowerCase() === word.toLowerCase()))
          .filter((w): w is Word => w != null)
          .map(w => ({ wordId: w.id, level: 4 as KnowledgeLevel }))
        if (updates.length > 0) {
          const newKb = bulkSetLevel(kb, updates)
          saveKnowledge(newKb, lang, source)
          setKb(newKb)
        }
      }

      if (newDragonHp <= 0) setTimeout(() => setGamePhase('won'), 600)
    } else {
      // Track session familiar words (placed by user but wrong)
      setSessionFamiliar(prev => {
        const next = new Set(prev)
        answer.forEach(t => next.add(t.text))
        return next
      })
      const newWizardHp = Math.max(0, wizardHp - CONFIG.WRONG_DAMAGE)
      setWizardHp(newWizardHp)
      triggerFlash('wizard', 'damage')
      if (newWizardHp <= 0) setTimeout(() => setGamePhase('lost'), 600)
    }
  }

  // ── Spell casters ──────────────────────────────────────────────────────────
  function castReveal() {
    if (phase !== 'playing' || wagerActive) return
    setRevealMode(r => !r)
  }

  function castDisperse() {
    if (phase !== 'playing' || wagerActive || dispersed) return
    const newHp = Math.max(0, wizardHp - CONFIG.DISPERSE_COST)
    setWizardHp(newHp)
    triggerFlash('wizard', 'damage')
    setDispersed(true)
    if (newHp <= 0) setGamePhase('lost')
  }

  function castWager() {
    if (phase !== 'playing' || wagerActive) return
    const newHp = Math.max(0, wizardHp - CONFIG.WAGER_COST)
    setWizardHp(newHp)
    triggerFlash('wizard', 'damage')
    setWagerActive(true)
    setRevealMode(false)
    if (newHp <= 0) setGamePhase('lost')
  }

  function restartGame() {
    setWizardHp(CONFIG.WIZARD_MAX_HP)
    setDragonHp(CONFIG.DRAGON_MAX_HP)
    setGamePhase('active')
    setScore({ correct: 0, total: 0 })
    setIdx(0)
    setSessionKnown(new Set())
    setSessionFamiliar(new Set())
    setSessionEncountered(new Set())
  }

  function lookupWordTexts(texts: string[]): Word[] {
    const list = wordsFor(lang)
    return texts
      .map(t => list.find(w => w.word.toLowerCase() === t.toLowerCase()))
      .filter((w): w is Word => w != null)
  }

  const isCorrect  = phase === 'correct'
  const isWrong    = phase === 'wrong'
  const answerSet  = new Set(sentence.answer.map(w => w.toLowerCase()))

  // ── Game over screens ──────────────────────────────────────────────────────
  if (gamePhase === 'won' || gamePhase === 'lost') {
    const isVictory = gamePhase === 'won'

    const knownWords    = lookupWordTexts([...sessionKnown])
    const familiarWords = lookupWordTexts([...sessionFamiliar].filter(w => !sessionKnown.has(w)))
    const seenWords     = lookupWordTexts(
      [...sessionEncountered].filter(w => !sessionKnown.has(w) && !sessionFamiliar.has(w))
    )

    const sections = [
      { label: 'Known',    color: '#22c55e', words: knownWords },
      { label: 'Familiar', color: '#f59e0b', words: familiarWords },
      { label: 'Seen',     color: '#ef4444', words: seenWords },
    ].filter(s => s.words.length > 0)

    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Result header */}
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">{isVictory ? '🏆' : '💀'}</div>
            <h1 className={`text-3xl font-bold mb-2 ${isVictory ? 'text-yellow-400' : 'text-red-400'}`}>
              {isVictory ? 'Victory!' : 'Defeated!'}
            </h1>
            <p className="text-gray-400 text-sm mb-1">
              {isVictory ? 'The dragon has been defeated!' : 'The wizard has fallen…'}
            </p>
            <p className="text-gray-600 text-sm">{score.correct} / {score.total} sentences correct</p>
          </div>

          {/* Score chips */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Known',    count: knownWords.length,    color: '#22c55e' },
              { label: 'Familiar', count: familiarWords.length, color: '#f59e0b' },
              { label: 'Seen',     count: seenWords.length,     color: '#ef4444' },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-gray-900 rounded-xl p-4 text-center border border-gray-800">
                <div className="text-2xl font-bold" style={{ color }}>{count}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Word lists */}
          {sections.map(({ label, color, words }) => (
            <div key={label} className="mb-5">
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color }}>
                {label}
              </div>
              <div className="flex flex-wrap gap-2">
                {words.map((w, i) => (
                  <span key={`${w.id}-${i}`} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm">
                    <span className="font-medium">{w.word}</span>
                    {w.characters && <span className="text-gray-500 ml-1">{w.characters}</span>}
                    <span className="text-gray-500 ml-1.5">· {w.english}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            <button
              onClick={restartGame}
              className={`flex-1 py-3 rounded-xl font-bold transition ${
                isVictory
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {isVictory ? 'Play Again' : 'Try Again'}
            </button>
            <Link
              href="/"
              className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-center transition"
            >
              ← Home
            </Link>
          </div>

        </div>
      </div>
    )
  }

  // ── Active game ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-none">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white hover:text-gray-300 transition" aria-label="Home">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </Link>
          <h1 className="text-lg font-semibold">
            {LANGUAGE_FLAGS[lang]} {LANGUAGE_NAMES[lang]} · Sentence Game
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="text-green-400 font-medium">{score.correct}</span>
          <span>/</span>
          <span>{score.total}</span>
          <span className="text-gray-700 mx-1">·</span>
          <span>{idx + 1} / {sentences.length}</span>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex-1 grid grid-cols-[240px_1fr_220px] gap-5 max-w-5xl w-full mx-auto px-5 py-6">

        {/* ── LEFT: Battle ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">

          {/* Dragon card */}
          <div className={`rounded-xl border p-4 text-center transition-colors duration-300 ${
            dragonFlash ? 'border-red-500 bg-red-950/40' : 'border-gray-800 bg-gray-900'
          }`}>
            <div className="text-5xl mb-2 select-none">🐉</div>
            <div className="text-sm font-semibold text-gray-300 mb-2">Dragon</div>
            <HPBar current={dragonHp} max={CONFIG.DRAGON_MAX_HP} color="red" />
            <div className="text-xs text-red-400 mt-1.5 font-medium">{dragonHp} / {CONFIG.DRAGON_MAX_HP}</div>
          </div>

          <div className="text-center text-gray-700 text-xs font-bold tracking-widest py-1">⚔ VS ⚔</div>

          {/* Wizard card */}
          <div className={`rounded-xl border p-4 text-center transition-colors duration-300 ${
            wizardFlash === 'damage' ? 'border-red-500 bg-red-950/40'   :
            wizardFlash === 'heal'   ? 'border-green-500 bg-green-950/40' :
            wagerActive              ? 'border-yellow-600 bg-yellow-950/20' :
                                       'border-gray-800 bg-gray-900'
          }`}>
            <div className="text-5xl mb-2 select-none">🧙‍♂️</div>
            <div className="text-sm font-semibold text-gray-300 mb-2">
              Wizard
              {wagerActive && <span className="ml-1.5 text-xs text-yellow-400 font-bold">⚡</span>}
            </div>
            <HPBar current={wizardHp} max={CONFIG.WIZARD_MAX_HP} color="green" />
            <div className="text-xs text-green-400 mt-1.5 font-medium">{wizardHp} / {CONFIG.WIZARD_MAX_HP}</div>
          </div>

          {/* Battle log */}
          {phase !== 'playing' && (
            <div className={`rounded-xl border px-3 py-2.5 text-xs text-center leading-relaxed ${
              isCorrect
                ? 'border-green-800 bg-green-950/20 text-green-400'
                : 'border-red-900 bg-red-950/20 text-red-400'
            }`}>
              {isCorrect ? (
                wagerActive ? (
                  <>⚡ Wager!<br />Dragon <strong>−{CONFIG.WAGER_DRAGON_DAMAGE}</strong> HP<br />Wizard <strong>+{CONFIG.WAGER_HEAL}</strong> HP</>
                ) : (
                  <>Dragon <strong>−{CONFIG.DRAGON_DAMAGE}</strong> HP</>
                )
              ) : (
                <>Wizard <strong>−{CONFIG.WRONG_DAMAGE}</strong> HP</>
              )}
            </div>
          )}
        </div>

        {/* ── CENTER: Sentence game ─────────────────────────────────────────── */}
        <div className="flex flex-col">

          {/* Prompt — shows source language sentence; user arranges target language tiles */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl px-6 py-5 mb-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              {isReversed
                ? `Translate to English`
                : `Translate to ${LANGUAGE_NAMES[lang]}`}
            </p>
            <p className="text-2xl font-semibold">
              &ldquo;{isReversed ? sentence.answer.join(' ') : sentence.english}&rdquo;
            </p>
          </div>

          {/* Answer tray */}
          <div className={`min-h-20 rounded-xl border-2 px-4 py-4 mb-3 flex flex-wrap gap-3 items-center transition-colors duration-200 ${
            isCorrect        ? 'border-green-500 bg-green-950/40'  :
            isWrong          ? 'border-red-500 bg-red-950/40'      :
            answer.length === 0 ? 'border-gray-700 border-dashed' :
                                  'border-blue-600 bg-gray-900'
          }`}>
            {answer.length === 0 && phase === 'playing' && (
              <span className="text-gray-600 text-sm">Tap words below to build your sentence…</span>
            )}
            {answer.map(tile => {
              const chars = lang === 'zh' ? getCharacters(tile.text) : null
              return (
                <button
                  key={tile.key}
                  onClick={() => returnToPool(tile)}
                  className={`flex flex-col items-center px-4 py-2 rounded-lg text-base font-semibold transition ${
                    phase === 'playing'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                      : isCorrect
                      ? 'bg-green-700 text-white cursor-default'
                      : 'bg-red-700 text-white cursor-default'
                  }`}
                >
                  {tile.text}
                  {chars && <span className="text-xs font-normal opacity-80 mt-0.5">{chars}</span>}
                </button>
              )
            })}
          </div>

          {/* Post-submit breakdown */}
          {phase !== 'playing' && (
            <div className={`rounded-xl border px-4 py-4 mb-4 ${
              isCorrect ? 'border-green-700 bg-green-950/30' : 'border-red-800 bg-red-950/20'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
                isCorrect ? 'text-green-400' : 'text-red-400'
              }`}>
                {isCorrect ? '✓ Correct!' : '✗ Correct answer'}
              </p>
              <div className="flex flex-wrap gap-3">
                {(isReversed ? sentence.english.split(/\s+/) : sentence.answer).map((word, i) => {
                  const translation = isReversed ? null : getTranslation(word, sentence, lang)
                  const chars = (!isReversed && lang === 'zh') ? getCharacters(word) : null
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <span className={`flex flex-col items-center px-3 py-2 rounded-lg text-base font-semibold ${
                        isCorrect ? 'bg-green-700 text-white' : 'bg-gray-700 text-white'
                      }`}>
                        {word}
                        {chars && <span className="text-sm font-normal opacity-90 mt-0.5">{chars}</span>}
                      </span>
                      {translation && <span className="text-xs text-gray-400">{translation}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Word pool */}
          <div className={`flex flex-wrap gap-3 mb-4 min-h-14 ${revealMode ? 'cursor-crosshair' : ''}`}>
            {pool.map(tile => {
              const chars       = lang === 'zh' ? getCharacters(tile.text) : null
              const isDistractor = dispersed && !answerSet.has(tile.text.toLowerCase())
              const isRevealed  = revealedWords.has(tile.text)
              const translation = isRevealed ? getTranslation(tile.text, sentence, lang) : null
              return (
                <button
                  key={tile.key}
                  onClick={() => pickFromPool(tile)}
                  className={`flex flex-col items-center px-4 py-2 rounded-lg text-base font-semibold transition active:scale-95 select-none ${
                    isDistractor
                      ? 'bg-gray-900 border border-gray-800 text-gray-700 opacity-40 cursor-not-allowed'
                      : revealMode
                      ? 'bg-purple-900 hover:bg-purple-800 border border-purple-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200'
                  }`}
                >
                  {tile.text}
                  {chars && <span className="text-xs font-normal text-gray-500 mt-0.5">{chars}</span>}
                  {translation && <span className="text-xs font-normal text-purple-300 mt-0.5">({translation})</span>}
                </button>
              )
            })}
          </div>

          {/* Action buttons */}
          <div>
            {phase === 'playing' ? (
              <button
                onClick={submit}
                disabled={answer.length === 0}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold transition"
              >
                {wagerActive ? '🪄 ⚡ Submit' : '🪄 Submit'}
              </button>
            ) : (
              <div className="flex gap-3">
                {isWrong && (
                  <button onClick={resetRound} className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold transition">
                    Try Again
                  </button>
                )}
                <button
                  onClick={() => setIdx(i => (i + 1) % sentences.length)}
                  className={`flex-1 py-3 rounded-xl text-white font-semibold transition ${
                    isCorrect ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Spells ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Spells</h2>

          {/* Reveal */}
          <button
            onClick={castReveal}
            disabled={phase !== 'playing' || wagerActive}
            className={`rounded-xl border p-4 text-left transition-colors ${
              revealMode
                ? 'border-purple-500 bg-purple-950/40 cursor-pointer'
                : phase !== 'playing' || wagerActive
                ? 'border-gray-800 bg-gray-900 opacity-40 cursor-not-allowed'
                : 'border-gray-700 bg-gray-900 hover:border-purple-700 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl select-none">🔍</span>
              <span className="text-xs text-red-400 font-semibold">−{CONFIG.REVEAL_COST} HP / word</span>
            </div>
            <div className="text-sm font-bold text-white mb-1">Reveal</div>
            <div className="text-xs text-gray-500 leading-snug">Click a word to see its translation</div>
            {revealMode && <div className="mt-2 text-xs text-purple-400 font-medium">→ Click a word…</div>}
          </button>

          {/* Disperse */}
          <button
            onClick={castDisperse}
            disabled={phase !== 'playing' || wagerActive || dispersed}
            className={`rounded-xl border p-4 text-left transition-colors ${
              dispersed
                ? 'border-gray-700 bg-gray-800/60 opacity-60 cursor-not-allowed'
                : phase !== 'playing' || wagerActive
                ? 'border-gray-800 bg-gray-900 opacity-40 cursor-not-allowed'
                : 'border-gray-700 bg-gray-900 hover:border-blue-700 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl select-none">💨</span>
              <span className="text-xs text-red-400 font-semibold">−{CONFIG.DISPERSE_COST} HP</span>
            </div>
            <div className="text-sm font-bold text-white mb-1">Disperse</div>
            <div className="text-xs text-gray-500 leading-snug">Grey out words not in the answer</div>
            {dispersed && <div className="mt-2 text-xs text-gray-500">Used this round</div>}
          </button>

          {/* Wager */}
          <button
            onClick={castWager}
            disabled={phase !== 'playing' || wagerActive}
            className={`rounded-xl border p-4 text-left transition-colors ${
              wagerActive
                ? 'border-yellow-600 bg-yellow-950/30 cursor-not-allowed'
                : phase !== 'playing'
                ? 'border-gray-800 bg-gray-900 opacity-40 cursor-not-allowed'
                : 'border-gray-700 bg-gray-900 hover:border-yellow-700 cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl select-none">⚡</span>
              <span className="text-xs text-red-400 font-semibold">−{CONFIG.WAGER_COST} HP</span>
            </div>
            <div className="text-sm font-bold text-white mb-1">Wager</div>
            <div className="text-xs text-gray-500 leading-snug">
              Win: dragon −{CONFIG.WAGER_DRAGON_DAMAGE} dmg · wizard +{CONFIG.WAGER_HEAL} HP
            </div>
            {wagerActive && <div className="mt-2 text-xs text-yellow-400 font-medium">⚡ Active this round</div>}
          </button>

          {/* Stat summary */}
          <div className="mt-auto rounded-xl border border-gray-800 bg-gray-900 p-3 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between"><span>Correct</span><span className="text-green-500">Dragon −{CONFIG.DRAGON_DAMAGE}</span></div>
            <div className="flex justify-between"><span>Wrong</span><span className="text-red-500">Wizard −{CONFIG.WRONG_DAMAGE}</span></div>
            <div className="flex justify-between"><span>Wager win</span><span className="text-yellow-500">Dragon −{CONFIG.WAGER_DRAGON_DAMAGE} · Wizard +{CONFIG.WAGER_HEAL}</span></div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function SentenceGamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <SentenceGameInner />
    </Suspense>
  )
}
