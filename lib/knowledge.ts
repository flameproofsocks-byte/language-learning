// Knowledge levels track how well the user knows each word:
//   1 = Unknown    — never seen, or consistently wrong
//   2 = Seen       — appeared but not claimed as known
//   3 = Familiar   — user claimed to know it, not yet verified by typing
//   4 = Known      — claimed AND verified by typing the correct translation
//
// Progress is persisted to data/knowledge_<key>.json on the server and
// cached in localStorage for instant initial renders.
//
// The key is a compound of source+target, e.g. "en_id" (English→Indonesian)
// or "id_en" (Indonesian→English). This keeps each learner pair separate.

export type KnowledgeLevel = 1 | 2 | 3 | 4

export interface WordRecord {
  wordId: string
  level: KnowledgeLevel
  timesShown: number
  timesCorrect: number
  lastSeen: string   // ISO date string
}

export interface KnowledgeBase {
  words: Record<string, WordRecord>  // keyed by word ID
  notes: Record<string, string>      // keyed by word ID — freeform memory tips written on the graph
  updatedAt: string
}

import type { Language, SourceLanguage } from './language'

// Compound key for a learning pair, e.g. "en_id" or "id_en".
// source=id always maps to target=en (the only supported reversed pair).
export function knowledgeKey(lang: Language, source: SourceLanguage = 'en'): string {
  const target = source === 'id' ? 'en' : lang
  return `${source}_${target}`
}

function localKey(lang: Language, source: SourceLanguage = 'en') {
  return `langlearn_knowledge_${knowledgeKey(lang, source)}`
}

function empty(): KnowledgeBase {
  return { words: {}, notes: {}, updatedAt: new Date().toISOString() }
}

// Read from localStorage cache — used for instant initial render without waiting for the API.
export function loadKnowledge(lang: Language = 'es', source: SourceLanguage = 'en'): KnowledgeBase {
  if (typeof window === 'undefined') return empty()
  try {
    const raw = localStorage.getItem(localKey(lang, source))
    if (raw) {
      const kb = JSON.parse(raw) as KnowledgeBase
      if (!kb.notes) kb.notes = {}  // migrate older saved data that predates the notes field
      return kb
    }
  } catch {}
  return empty()
}

// Persist to the server (source of truth) and update the localStorage cache simultaneously.
export async function saveKnowledge(kb: KnowledgeBase, lang: Language = 'es', source: SourceLanguage = 'en'): Promise<void> {
  kb.updatedAt = new Date().toISOString()
  const key = knowledgeKey(lang, source)
  if (typeof window !== 'undefined') {
    localStorage.setItem(localKey(lang, source), JSON.stringify(kb))
  }
  await fetch(`/api/knowledge/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(kb),
  })
}

// Fetch the authoritative knowledge base from the server and refresh the cache.
// Falls back to the localStorage cache if the server is unreachable.
export async function fetchKnowledge(lang: Language = 'es', source: SourceLanguage = 'en'): Promise<KnowledgeBase> {
  const key = knowledgeKey(lang, source)
  try {
    const res = await fetch(`/api/knowledge/${key}`)
    if (!res.ok) throw new Error('fetch failed')
    const kb = await res.json() as KnowledgeBase
    if (!kb.notes) kb.notes = {}  // migrate older data
    if (typeof window !== 'undefined') {
      localStorage.setItem(localKey(lang, source), JSON.stringify(kb))
    }
    return kb
  } catch {
    return loadKnowledge(lang, source)
  }
}

export function getLevel(kb: KnowledgeBase, wordId: string): KnowledgeLevel {
  return kb.words[wordId]?.level ?? 1
}

// Returns a new KnowledgeBase with the word's level updated. Increments timesShown
// and timesCorrect so statistics remain accurate over time.
export function setLevel(kb: KnowledgeBase, wordId: string, level: KnowledgeLevel): KnowledgeBase {
  const now = new Date().toISOString()
  const existing = kb.words[wordId]
  return {
    ...kb,
    words: {
      ...kb.words,
      [wordId]: {
        wordId,
        level,
        timesShown: (existing?.timesShown ?? 0) + 1,
        timesCorrect: level === 4 ? (existing?.timesCorrect ?? 0) + 1 : (existing?.timesCorrect ?? 0),
        lastSeen: now,
      },
    },
  }
}

// Apply multiple level updates at once — used at the end of a testing session.
export function bulkSetLevel(
  kb: KnowledgeBase,
  updates: { wordId: string; level: KnowledgeLevel }[]
): KnowledgeBase {
  let result = kb
  for (const u of updates) {
    result = setLevel(result, u.wordId, u.level)
  }
  return result
}

// Save or delete a memory tip for a word on the knowledge graph.
// Passing an empty/whitespace-only string removes the note entirely.
export function setNote(kb: KnowledgeBase, wordId: string, note: string): KnowledgeBase {
  const notes = { ...kb.notes }
  if (note.trim()) {
    notes[wordId] = note.trim()
  } else {
    delete notes[wordId]
  }
  return { ...kb, notes }
}

export function levelLabel(level: KnowledgeLevel): string {
  switch (level) {
    case 1: return 'Unknown'
    case 2: return 'Seen'
    case 3: return 'Familiar'
    case 4: return 'Known'
  }
}

// Colors mirror the graph node colors — gray/red/amber/green for 1/2/3/4.
export function levelColor(level: KnowledgeLevel): string {
  switch (level) {
    case 1: return '#6b7280'
    case 2: return '#ef4444'
    case 3: return '#f59e0b'
    case 4: return '#22c55e'
  }
}
