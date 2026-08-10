'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { fetchKnowledge, saveKnowledge, setNote, KnowledgeBase, levelColor, levelLabel, KnowledgeLevel } from '@/lib/knowledge'
import { wordsFor } from '@/lib/language-data'
import { Word } from '@/lib/words'
import { Language, LANGUAGE_NAMES, LANGUAGE_FLAGS, SourceLanguage } from '@/lib/language'
import { RELATION_COLOR, RelationType } from '@/lib/relations'
import type { KnowledgeGraphHandle } from '@/components/KnowledgeGraph'

const KnowledgeGraph = dynamic(() => import('@/components/KnowledgeGraph'), { ssr: false })

const LEVELS: { level: KnowledgeLevel; label: string }[] = [
  { level: 4, label: 'Known' },
  { level: 3, label: 'Familiar' },
  { level: 2, label: 'Seen' },
]

interface NotePanel {
  wordId: string
  word: Word
}

function GraphInner() {
  const searchParams = useSearchParams()
  const lang   = (searchParams.get('lang')   ?? 'es') as Language
  const source = (searchParams.get('source') ?? 'en') as SourceLanguage

  const [kb, setKb]               = useState<KnowledgeBase | null>(null)
  const [panel, setPanel]         = useState<NotePanel | null>(null)
  const [noteText, setNoteText]   = useState('')
  const [saving, setSaving]       = useState(false)
  const graphRef = useRef<KnowledgeGraphHandle>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchKnowledge(lang, source).then(setKb)
  }, [lang])

  const handleNodeClick = useCallback((wordId: string, word: Word) => {
    setPanel({ wordId, word })
    setNoteText(kb?.notes?.[wordId] ?? '')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [kb])

  function closePanel() {
    setPanel(null)
    setNoteText('')
  }

  async function saveNote() {
    if (!panel || !kb) return
    setSaving(true)
    const updated = setNote(kb, panel.wordId, noteText)
    setKb(updated)
    await saveKnowledge(updated, lang, source)
    setSaving(false)
    closePanel()
  }

  if (!kb) return null

  const allWords = wordsFor(lang)
  const encountered = allWords.filter(w => (kb.words[w.id]?.level ?? 1) >= 2)
  const counts = LEVELS.map(({ level, label }) => ({
    level, label,
    count: allWords.filter(w => (kb.words[w.id]?.level ?? 1) === level).length,
  }))

  const panelWord = panel ? kb.words[panel.wordId] : null
  const noteCount = Object.keys(kb.notes ?? {}).length

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white hover:text-gray-300 transition" aria-label="Home">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold">
              {LANGUAGE_FLAGS[lang]} {LANGUAGE_NAMES[lang]} · Knowledge Graph
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {encountered.length} words encountered · click a node to add a note · scroll to zoom
              {noteCount > 0 && <span className="text-amber-400 ml-2">· {noteCount} note{noteCount !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Node legend */}
          <div className="flex items-center gap-3">
            {LEVELS.map(({ level, label }) => (
              <div key={level} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: levelColor(level) }} />
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-xs text-gray-600">({counts.find(c => c.level === level)?.count ?? 0})</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 border-l border-gray-800 pl-3">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-xs text-gray-400">Has note</span>
            </div>
          </div>
          {/* Edge legend */}
          <div className="flex items-center gap-3 border-l border-gray-800 pl-3">
            {([
              { type: 'antonym',  dash: '4 3' },
              { type: 'synonym',  dash: undefined },
              { type: 'category', dash: undefined },
              { type: 'domain',   dash: '6 3' },
            ] as { type: RelationType; dash?: string }[]).map(({ type, dash }) => (
              <div key={type} className="flex items-center gap-1.5">
                <svg width="18" height="8">
                  <line x1="0" y1="4" x2="18" y2="4"
                    stroke={RELATION_COLOR[type]}
                    strokeWidth={1.5}
                    strokeDasharray={dash}
                    strokeOpacity={0.85}
                  />
                </svg>
                <span className="text-xs text-gray-500 capitalize">{type}</span>
              </div>
            ))}
          </div>
          <Link
            href={`/testing?lang=${lang}`}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
          >
            + Test Words
          </Link>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 min-h-0 relative">
        <KnowledgeGraph ref={graphRef} kb={kb} lang={lang} onNodeClick={handleNodeClick} />

        {/* Zoom controls */}
        <div className="absolute bottom-5 right-5 flex flex-col gap-1.5">
          <button onClick={() => graphRef.current?.zoomIn()} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-xl font-light flex items-center justify-center transition select-none" aria-label="Zoom in">+</button>
          <button onClick={() => graphRef.current?.zoomOut()} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-xl font-light flex items-center justify-center transition select-none" aria-label="Zoom out">−</button>
          <button onClick={() => graphRef.current?.resetZoom()} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 text-xs font-medium flex items-center justify-center transition select-none" aria-label="Reset zoom">⊙</button>
          <button onClick={() => graphRef.current?.relax()} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 text-xs font-medium flex items-center justify-center transition select-none" aria-label="Relax layout" title="Relax layout">↺</button>
        </div>

        {/* Note panel — slides in from the right */}
        {panel && (
          <>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30" onClick={closePanel} />

            {/* Panel */}
            <div className="absolute top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl">
              {/* Panel header */}
              <div className="flex items-start justify-between p-5 border-b border-gray-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {panel.word.characters && (
                      <span className="text-gray-400 text-lg">{panel.word.characters}</span>
                    )}
                    <span className="text-2xl font-bold text-white">{panel.word.word}</span>
                  </div>
                  <div className="text-gray-400 text-sm">{panel.word.english}</div>
                  {panelWord && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: levelColor(panelWord.level) }} />
                      <span className="text-xs" style={{ color: levelColor(panelWord.level) }}>
                        {levelLabel(panelWord.level)}
                      </span>
                    </div>
                  )}
                </div>
                <button onClick={closePanel} className="text-gray-500 hover:text-gray-300 transition mt-1 text-lg leading-none">✕</button>
              </div>

              {/* Note area */}
              <div className="flex-1 flex flex-col p-5 gap-3 overflow-hidden">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Memory tip / note
                </label>
                <textarea
                  ref={textareaRef}
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder={`How do you remember "${panel.word.word}"? Write a tip, mnemonic, or example sentence…`}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm p-3 resize-none focus:outline-none focus:border-indigo-500 placeholder-gray-600 leading-relaxed"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote()
                    if (e.key === 'Escape') closePanel()
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveNote}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition"
                  >
                    {saving ? 'Saving…' : 'Save note'}
                  </button>
                  {(kb.notes?.[panel.wordId]) && (
                    <button
                      onClick={async () => {
                        setNoteText('')
                        const updated = setNote(kb, panel.wordId, '')
                        setKb(updated)
                        await saveKnowledge(updated, lang, source)
                        closePanel()
                      }}
                      className="px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-red-900/50 border border-gray-700 text-gray-400 hover:text-red-400 text-sm transition"
                      title="Delete note"
                    >
                      🗑
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-600">⌘ Enter to save · Esc to close</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-gray-950" />}>
      <GraphInner />
    </Suspense>
  )
}
