'use client'

// Vocabulary Knowledge Graph — a freeform Rosetta Stone canvas.
//
// - Left-click node  → translation popup
// - Right-click node → context menu (connect / add note / remove)
// - Right-click canvas → add a word node at that grid position
// - Drag nodes to reposition; they snap to the nearest free grid cell on release
// - Triangular grid drawn in the background; nodes stored by (gridCol, gridRow)
// - Sidebar: language selector + suggested words

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { SPANISH_WORDS } from '@/lib/words'
import { MANDARIN_WORDS } from '@/lib/mandarin'
import { INDONESIAN_WORDS } from '@/lib/indonesian'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

// ── Types ─────────────────────────────────────────────────────────────────────

export type DisplayLang = 'en' | 'es' | 'zh' | 'id'

export type POS =
  | 'verb' | 'noun' | 'adjective' | 'adverb'
  | 'pronoun' | 'preposition' | 'conjunction' | 'number' | 'article'

export interface VocabNode {
  id: string
  nodeType?: 'word' | 'note'   // defaults to 'word' for backward compat
  english: string               // for note nodes this holds the note text
  translations: Partial<Record<DisplayLang, string>>
  pos: POS
  note?: string
  gridCol: number   // integer column in the triangular lattice (stored)
  gridRow: number   // integer row in the triangular lattice (stored)
  // react-force-graph injects x/y/vx/vy/fx/fy at runtime
  x?: number; y?: number
}

export type EdgeType = 'default' | 'synonym' | 'antonym' | 'category' | 'intensity'

export interface VocabEdge {
  source: string
  target: string
  type?: EdgeType
}
export interface VocabGraph { nodes: VocabNode[]; edges: VocabEdge[] }

// ── POS colors ────────────────────────────────────────────────────────────────

const POS_COLOR: Record<POS, string> = {
  verb:        '#3b82f6',
  noun:        '#10b981',
  adjective:   '#f59e0b',
  adverb:      '#8b5cf6',
  pronoun:     '#ec4899',
  preposition: '#14b8a6',
  conjunction: '#6b7280',
  number:      '#f97316',
  article:     '#64748b',
}
const POS_LIST = Object.keys(POS_COLOR) as POS[]

// ── Language meta ─────────────────────────────────────────────────────────────

const DISPLAY_LANGS: { code: DisplayLang; label: string; flag: string }[] = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'es', label: 'Spanish',    flag: '🇪🇸' },
  { code: 'zh', label: 'Mandarin',   flag: '🇨🇳' },
  { code: 'id', label: 'Indonesian', flag: '🇮🇩' },
]

// ── Triangular grid ───────────────────────────────────────────────────────────
//
// Nodes sit on an equilateral triangular lattice. Even rows are at x = col*W,
// odd rows are offset by W/2. This produces equilateral triangles with side W.
//
//  Row 0 (even): •──•──•──•       x = col * W
//  Row 1 (odd):   •──•──•──•      x = col * W + W/2
//  Row 2 (even): •──•──•──•
//
// The (0,0) cell is at the graph-space origin (canvas centre).

const GRID_W    = 90                          // horizontal distance between lattice columns (graph units)
const GRID_H    = GRID_W * Math.sqrt(3) / 2  // vertical distance between rows ≈ 77.9
const RING_PAD  = 7                           // extra radius (graph units) for the outer click ring
const EDGE_HIT  = 10                          // graph-unit radius for edge right-click hit detection

// Visual style per edge type
const EDGE_META: Record<EdgeType, { color: string; label: string; symbol: string; desc: string }> = {
  default:   { color: '#5a7090', label: 'Related',   symbol: '—',  desc: 'general connection' },
  synonym:   { color: '#22c55e', label: 'Synonym',   symbol: '≈',  desc: 'similar meaning' },
  antonym:   { color: '#ef4444', label: 'Antonym',   symbol: '⊓',  desc: 'opposite meaning' },
  category:  { color: '#a855f7', label: 'Category',  symbol: '═',  desc: 'belongs to category' },
  intensity: { color: '#f97316', label: 'Intensity', symbol: '↗',  desc: 'degree / intensity' },
}

/** Perpendicular distance from point (px,py) to segment (ax,ay)→(bx,by) */
function ptSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

/** Lattice (col, row) → graph-space (x, y) */
function gridToPixel(col: number, row: number): { x: number; y: number } {
  const offset = (row & 1) !== 0 ? GRID_W / 2 : 0
  return { x: col * GRID_W + offset, y: row * GRID_H }
}

/** Graph-space (x, y) → nearest lattice (col, row), brute-forcing 9 candidates */
function pixelToGrid(px: number, py: number): { col: number; row: number } {
  const rowApprox = Math.round(py / GRID_H)
  let best = { col: 0, row: rowApprox }
  let bestDist = Infinity
  for (let r = rowApprox - 1; r <= rowApprox + 1; r++) {
    const offset = (r & 1) !== 0 ? GRID_W / 2 : 0
    const colApprox = Math.round((px - offset) / GRID_W)
    for (let c = colApprox - 1; c <= colApprox + 1; c++) {
      const p = gridToPixel(c, r)
      const dist = (px - p.x) ** 2 + (py - p.y) ** 2
      if (dist < bestDist) { bestDist = dist; best = { col: c, row: r } }
    }
  }
  return best
}

/** Produce the set of occupied cells as "col,row" strings */
function occupiedSet(nodes: VocabNode[], excludeId?: string): Set<string> {
  return new Set(nodes.filter(n => n.id !== excludeId).map(n => `${n.gridCol},${n.gridRow}`))
}

/** Find the nearest free grid point to (px,py), skipping the node being moved */
function snapToFree(
  px: number, py: number,
  nodes: VocabNode[], excludeId: string,
): { col: number; row: number } {
  const { col, row } = pixelToGrid(px, py)
  const taken = occupiedSet(nodes, excludeId)
  if (!taken.has(`${col},${row}`)) return { col, row }
  // Spiral out until a free cell is found
  for (let radius = 1; radius <= 30; radius++) {
    let best: { col: number; row: number } | null = null
    let bestDist = Infinity
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue
        const c = col + dc, r = row + dr
        if (taken.has(`${c},${r}`)) continue
        const p = gridToPixel(c, r)
        const d = (px - p.x) ** 2 + (py - p.y) ** 2
        if (d < bestDist) { bestDist = d; best = { col: c, row: r } }
      }
    }
    if (best) return best
  }
  return { col, row }
}

/** Find the nearest free grid point to the origin for a brand-new node */
function findFreeNearOrigin(nodes: VocabNode[]): { col: number; row: number } {
  const taken = occupiedSet(nodes)
  // Row-by-row scan from origin
  for (let r = 0; r <= 30; r++) {
    for (let c = 0; c <= r; c++) {
      for (const [cc, rr] of [[c, r], [-c, r], [c, -r], [-c, -r]]) {
        if (!taken.has(`${cc},${rr}`)) return { col: cc, row: rr }
      }
    }
  }
  return { col: 0, row: 0 }
}

// ── Suggestion pool ───────────────────────────────────────────────────────────

interface Suggestion {
  english: string
  pos: POS
  translations: Partial<Record<DisplayLang, string>>
}

function buildSuggestions(): Suggestion[] {
  const map = new Map<string, Suggestion>()
  for (const w of SPANISH_WORDS)
    map.set(w.english, { english: w.english, pos: w.pos as POS, translations: { en: w.english, es: w.word } })
  for (const w of MANDARIN_WORDS) {
    const e = map.get(w.english)
    if (e) e.translations.zh = w.word
    else map.set(w.english, { english: w.english, pos: w.pos as POS, translations: { en: w.english, zh: w.word } })
  }
  for (const w of INDONESIAN_WORDS) {
    const e = map.get(w.english)
    if (e) e.translations.id = w.word
    else map.set(w.english, { english: w.english, pos: w.pos as POS, translations: { en: w.english, id: w.word } })
  }
  return Array.from(map.values()).sort((a, b) => a.english.localeCompare(b.english))
}
const ALL_SUGGESTIONS = buildSuggestions()

// ── Persistence ───────────────────────────────────────────────────────────────

const LOCAL_KEY = 'langlearn_vocab_graph'

function graphFromLocal(): VocabGraph | null {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null') } catch { return null }
}

async function loadGraph(): Promise<VocabGraph> {
  try {
    const res  = await fetch('/api/vocab-graph')
    const data = await res.json() as VocabGraph
    if (data.nodes?.length || data.edges?.length) return data
  } catch {}
  return graphFromLocal() ?? { nodes: [], edges: [] }
}

async function saveGraph(g: VocabGraph) {
  if (typeof window !== 'undefined') localStorage.setItem(LOCAL_KEY, JSON.stringify(g))
  fetch('/api/vocab-graph', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(g),
  }).catch(() => {})
}

// ── Add-word modal ────────────────────────────────────────────────────────────

function AddWordModal({ suggestion, onAdd, onClose }: {
  suggestion?: Suggestion
  onAdd: (node: Omit<VocabNode, 'id' | 'gridCol' | 'gridRow'>) => void
  onClose: () => void
}) {
  const [english, setEnglish] = useState(suggestion?.english ?? '')
  const [pos, setPos]         = useState<POS>(suggestion?.pos ?? 'noun')
  const [es, setEs]           = useState(suggestion?.translations.es ?? '')
  const [zh, setZh]           = useState(suggestion?.translations.zh ?? '')
  const [id, setId]           = useState(suggestion?.translations.id ?? '')
  const [loading, setLoading] = useState(false)

  async function autoTranslate(field: 'es' | 'zh' | 'id', setter: (v: string) => void) {
    if (!english.trim()) return; setLoading(true)
    try {
      const res = await fetch(`/api/translate?word=${encodeURIComponent(english)}&lang=${field}&from=en`)
      const { translation } = await res.json()
      if (translation) setter(translation)
    } catch {}
    setLoading(false)
  }

  function handleSubmit() {
    const word = english.trim(); if (!word) return
    onAdd({ english: word, pos, translations: { en: word, ...(es.trim() ? { es: es.trim() } : {}), ...(zh.trim() ? { zh: zh.trim() } : {}), ...(id.trim() ? { id: id.trim() } : {}) } })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">Add Word / Phrase Node</h2>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">English — word or phrase</label>
        <input autoFocus value={english} onChange={e => setEnglish(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="e.g. to run · good morning · I don't know"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-blue-500" />
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">
          Part of speech <span className="normal-case text-gray-600">(optional for phrases)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {POS_LIST.map(p => (
            <button key={p} onClick={() => setPos(p)} className="px-2.5 py-1 rounded-lg text-xs font-semibold transition"
              style={{ background: pos === p ? POS_COLOR[p] : '#1f2937', color: pos === p ? '#fff' : '#9ca3af', border: `1px solid ${pos === p ? POS_COLOR[p] : '#374151'}` }}>
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400 uppercase tracking-wider">Translations (optional)</label>
          <button
            onClick={async () => {
              if (!english.trim() || loading) return
              await Promise.all([
                autoTranslate('es', setEs),
                autoTranslate('zh', setZh),
                autoTranslate('id', setId),
              ])
            }}
            disabled={loading || !english.trim()}
            className="text-xs text-blue-500 hover:text-blue-300 disabled:opacity-30 transition"
          >
            {loading ? 'Translating…' : '⟳ Translate all'}
          </button>
        </div>
        <div className="flex flex-col gap-2 mb-5">
          {([['es', '🇪🇸 Spanish', es, setEs], ['zh', '🇨🇳 Mandarin', zh, setZh], ['id', '🇮🇩 Indonesian', id, setId]] as const).map(([lang, label, val, set]) => (
            <div key={lang} className="flex gap-2 items-center">
              <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
              <input value={val} onChange={e => set(e.target.value)} placeholder="leave blank to auto-translate"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" />
              <button onClick={() => autoTranslate(lang, set)} disabled={loading || !english.trim()} title="Auto-translate"
                className="text-xs text-gray-500 hover:text-blue-400 transition disabled:opacity-30 px-1">{loading ? '…' : '⟳'}</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={!english.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition">
            Add to graph
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Note modal ────────────────────────────────────────────────────────────────

function NoteModal({ node, onSave, onClose }: {
  node: VocabNode; onSave: (note: string) => void; onClose: () => void
}) {
  const [text, setText] = useState(node.note ?? '')
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Note</h2>
        <p className="text-xs text-gray-500 mb-4">Shown below <span className="text-gray-300 font-medium">{node.english}</span> on the graph</p>
        <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
          placeholder="e.g. used in formal contexts, remember the accent…" rows={4}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-blue-500 resize-none" />
        <div className="flex gap-2">
          <button onClick={() => onSave(text.trim())}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition">
            Save note
          </button>
          {node.note && (
            <button onClick={() => onSave('')}
              className="px-4 py-2.5 rounded-xl border border-gray-700 hover:border-red-700 hover:text-red-400 text-gray-500 text-sm transition">
              Remove
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Node translation popup (left-click) ───────────────────────────────────────

function NodePopup({ x, y, node, onClose, onSaveTranslation }: {
  x: number; y: number; node: VocabNode; onClose: () => void
  onSaveTranslation: (lang: DisplayLang, value: string) => void
}) {
  const [editing, setEditing] = useState<DisplayLang | null>(null)
  const [editVal, setEditVal] = useState('')

  const color = POS_COLOR[node.pos] ?? '#6b7280'
  const style: React.CSSProperties = {
    left: Math.min(x + 12, window.innerWidth - 230),
    top:  Math.min(y + 12, window.innerHeight - 300),
  }

  function startEdit(lang: DisplayLang) {
    setEditing(lang)
    setEditVal(node.translations[lang] ?? '')
  }

  function commitEdit() {
    if (!editing) return
    onSaveTranslation(editing, editVal.trim())
    setEditing(null)
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden w-56" style={style}>
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2" style={{ borderLeft: `3px solid ${color}` }}>
          <span className="font-semibold text-white text-sm">{node.english}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-md font-medium ml-auto" style={{ background: color + '33', color }}>{node.pos}</span>
        </div>
        <div className="py-1">
          {DISPLAY_LANGS.map(l => {
            const text = node.translations[l.code]
            const isEditing = editing === l.code
            return (
              <div key={l.code} className="group flex items-center gap-2 px-3 py-1.5">
                <span className="text-base leading-none shrink-0">{l.flag}</span>
                <span className="text-xs text-gray-500 w-16 shrink-0">{l.label}</span>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  { e.preventDefault(); commitEdit() }
                      if (e.key === 'Escape') { e.preventDefault(); setEditing(null) }
                    }}
                    onBlur={commitEdit}
                    className="flex-1 min-w-0 bg-gray-800 border border-blue-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                  />
                ) : (
                  <>
                    <span className={`flex-1 text-xs font-medium truncate ${text ? 'text-white' : 'text-gray-600'}`}>
                      {text ?? '—'}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); startEdit(l.code) }}
                      className="opacity-0 group-hover:opacity-100 transition text-gray-600 hover:text-gray-300 shrink-0 text-xs px-1"
                      title={`Edit ${l.label} translation`}
                    >✎</button>
                  </>
                )}
              </div>
            )
          })}
        </div>
        {node.note && (
          <div className="px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Note</p>
            <p className="text-xs text-gray-300 leading-relaxed">{node.note}</p>
          </div>
        )}
        <div className="px-4 py-2 border-t border-gray-800">
          <p className="text-xs text-gray-600">({node.gridCol}, {node.gridRow})</p>
        </div>
      </div>
    </>
  )
}

// ── Node context menu (right-click) ───────────────────────────────────────────

function ContextMenu({ x, y, label, hasNote, onConnect, onAppend, onNote, onRename, onRemove, onClose }: {
  x: number; y: number; label: string; hasNote: boolean
  onConnect: () => void; onAppend: () => void; onNote: () => void
  onRename: () => void; onRemove: () => void; onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} />
      <div className="fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-48"
        style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 200) }}>
        <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-700 font-medium truncate">{label}</div>
        <button onClick={() => { onConnect(); onClose() }}
          className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition flex items-center gap-2">
          <span className="text-gray-500">⟷</span> Connect to node
        </button>
        <button onClick={() => { onAppend(); onClose() }}
          className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition flex items-center gap-2 border-t border-gray-800">
          <span className="text-gray-500">✦</span> Append new node
        </button>
        <button onClick={() => { onNote(); onClose() }}
          className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition flex items-center gap-2 border-t border-gray-800">
          <span className="text-gray-500">📝</span> {hasNote ? 'Edit note' : 'Add note'}
        </button>
        <button onClick={() => { onRename(); onClose() }}
          className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition flex items-center gap-2 border-t border-gray-800">
          <span className="text-gray-500">✎</span> Rename
        </button>
        <button onClick={() => { onRemove(); onClose() }}
          className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/40 transition flex items-center gap-2 border-t border-gray-800">
          <span className="text-red-700">✕</span> Remove node
        </button>
      </div>
    </>
  )
}

// ── Rename modal ──────────────────────────────────────────────────────────────

function RenameModal({ node, onSave, onClose }: {
  node: VocabNode; onSave: (value: string) => void; onClose: () => void
}) {
  const [value, setValue] = useState(node.english)
  const isNote = node.nodeType === 'note'
  const confirm = () => { if (value.trim()) onSave(value.trim()) }
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-5 w-80">
        <h2 className="text-white font-semibold mb-3">
          {isNote ? 'Edit note' : 'Rename word'}
        </h2>
        {isNote ? (
          <textarea
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) confirm() }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
            rows={3}
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') onClose() }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          />
        )}
        <div className="flex gap-2 mt-3 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition">Cancel</button>
          <button onClick={confirm} disabled={!value.trim()}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-40 transition">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edge context menu (right-click on a connection line) ──────────────────────

const EDGE_TYPE_LIST: EdgeType[] = ['default', 'synonym', 'antonym', 'category', 'intensity']

function EdgeContextMenu({ x, y, edge, onSetType, onRemove, onClose }: {
  x: number; y: number; edge: VocabEdge
  onSetType: (t: EdgeType) => void; onRemove: () => void; onClose: () => void
}) {
  const current = edge.type ?? 'default'
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} />
      <div className="fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden w-56"
        style={{ left: Math.min(x, window.innerWidth - 230), top: Math.min(y, window.innerHeight - 260) }}>
        <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-700 font-medium">Connection type</div>
        {EDGE_TYPE_LIST.map(t => {
          const m = EDGE_META[t]
          return (
            <button key={t} onClick={() => { onSetType(t); onClose() }}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition ${
                current === t ? 'bg-gray-800' : 'hover:bg-gray-800/60'
              }`}>
              <span className="w-5 text-center text-base font-mono shrink-0" style={{ color: m.color }}>{m.symbol}</span>
              <div className="min-w-0">
                <div className={`text-sm font-medium ${current === t ? 'text-white' : 'text-gray-300'}`}>{m.label}</div>
                <div className="text-xs text-gray-600 truncate">{m.desc}</div>
              </div>
              {current === t && <span className="text-gray-500 ml-auto text-xs">✓</span>}
            </button>
          )
        })}
        <div className="border-t border-gray-800">
          <button onClick={() => { onRemove(); onClose() }}
            className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/40 transition flex items-center gap-2">
            <span className="text-red-700">✕</span> Remove connection
          </button>
        </div>
      </div>
    </>
  )
}

// ── Background context menu (right-click on empty canvas) ─────────────────────

function BgContextMenu({ x, y, onAddWord, onAddNote, onClose }: {
  x: number; y: number
  onAddWord: () => void; onAddNote: () => void; onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} />
      <div className="fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-44"
        style={{ left: Math.min(x, window.innerWidth - 185), top: Math.min(y, window.innerHeight - 100) }}>
        <button onClick={() => { onAddWord(); onClose() }}
          className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition flex items-center gap-2">
          <span className="text-gray-500">📖</span> Add word
        </button>
        <button onClick={() => { onAddNote(); onClose() }}
          className="w-full text-left px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition flex items-center gap-2 border-t border-gray-800">
          <span className="text-gray-500">📝</span> Add note
        </button>
      </div>
    </>
  )
}

// ── Add-note-node modal ────────────────────────────────────────────────────────

function AddNoteNodeModal({ onAdd, onClose }: {
  onAdd: (text: string) => void; onClose: () => void
}) {
  const [text, setText] = useState('')
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-5 w-80">
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span>📝</span> Add note node
        </h2>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) onAdd(text.trim()) }}
          placeholder="Note text…"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none"
          rows={3}
        />
        <div className="flex gap-2 mt-3 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition">Cancel</button>
          <button onClick={() => text.trim() && onAdd(text.trim())} disabled={!text.trim()}
            className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-40 transition">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VocabGraphPage() {
  const [graph, setGraph]               = useState<VocabGraph>({ nodes: [], edges: [] })
  const [displayLang, setDisplayLang]   = useState<DisplayLang>('en')
  const [search, setSearch]             = useState('')
  const [addModal, setAddModal]         = useState<{ suggestion?: Suggestion } | null>(null)
  const [noteModal, setNoteModal]       = useState<VocabNode | null>(null)
  const [ctxMenu, setCtxMenu]           = useState<{ x: number; y: number; node: VocabNode } | null>(null)
  const [nodePopup, setNodePopup]       = useState<{ x: number; y: number; node: VocabNode } | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [appendingFrom,  setAppendingFrom]  = useState<string | null>(null)
  const [secondaryLang,  setSecondaryLang]  = useState<DisplayLang | null>(null)
  const [edgeCtxMenu,    setEdgeCtxMenu]    = useState<{ x: number; y: number; edge: VocabEdge } | null>(null)
  const [loaded, setLoaded]             = useState(false)
  const [xlating, setXlating]           = useState(false)
  const [xlateStatus, setXlateStatus]   = useState<string | null>(null)
  const [bgCtxMenu, setBgCtxMenu]       = useState<{ x: number; y: number } | null>(null)
  const [noteNodeModal, setNoteNodeModal] = useState(false)
  const [renameModal, setRenameModal]   = useState<VocabNode | null>(null)
  const [loadingPOS, setLoadingPOS]     = useState(false)
  const [posStatus, setPosStatus]       = useState<string | null>(null)

  const containerRef          = useRef<HTMLDivElement>(null)
  const fgRef                 = useRef<any>(null)
  const connectingFromRef     = useRef<string | null>(null)
  const appendingFromRef      = useRef<string | null>(null)
  const appendFromIdForNew    = useRef<string | null>(null)
  const displayLangRef        = useRef<DisplayLang>('en')
  const secondaryLangRef      = useRef<DisplayLang | null>(null)
  const graphRef              = useRef<VocabGraph>({ nodes: [], edges: [] })
  const bgClickGridRef        = useRef<{ col: number; row: number } | null>(null)
  const wasDragging           = useRef(false)   // set on node drag-end; suppresses the next click

  useEffect(() => { connectingFromRef.current  = connectingFrom }, [connectingFrom])
  useEffect(() => { appendingFromRef.current   = appendingFrom  }, [appendingFrom])
  useEffect(() => { displayLangRef.current     = displayLang    }, [displayLang])
  useEffect(() => { secondaryLangRef.current   = secondaryLang  }, [secondaryLang])
  useEffect(() => { graphRef.current           = graph          }, [graph])

  // ── Load — assign grid coords to any legacy nodes that lack them
  useEffect(() => {
    loadGraph().then(raw => {
      const taken = new Set<string>()
      const nodes = raw.nodes.map(n => {
        // Already has valid grid coords — keep them
        if (n.gridCol != null && n.gridRow != null) {
          taken.add(`${n.gridCol},${n.gridRow}`)
          return n
        }
        // Legacy node — find it a free slot
        const pos = findFreeNearOrigin(
          raw.nodes.filter(x => taken.has(`${x.gridCol},${x.gridRow}`)) as VocabNode[]
        )
        taken.add(`${pos.col},${pos.row}`)
        return { ...n, gridCol: pos.col, gridRow: pos.row }
      })
      setGraph({ ...raw, nodes })
      setLoaded(true)
    })
  }, [])

  // ── Debounced save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loaded) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveGraph(graphRef.current), 800)
  }, [graph, loaded])

  // ── Cancel connect / append mode on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setConnectingFrom(null); setAppendingFrom(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Helpers
  function labelFor(node: VocabNode): string {
    return node.translations[displayLangRef.current] ?? node.translations.en ?? node.english
  }

  function addNode(data: Omit<VocabNode, 'id' | 'gridCol' | 'gridRow'>) {
    const id          = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const fromId      = appendFromIdForNew.current   // may be set by "Append new node" / connect mode
    const targetGrid  = bgClickGridRef.current       // snapshot before setGraph — updater runs twice
    appendFromIdForNew.current = null                // in React 18 strict mode, so refs must be
    bgClickGridRef.current     = null                // read outside the updater, not inside it
    setGraph(g => {
      const pos = targetGrid
        ? snapToFree(
            gridToPixel(targetGrid.col, targetGrid.row).x,
            gridToPixel(targetGrid.col, targetGrid.row).y,
            g.nodes, id
          )
        : findFreeNearOrigin(g.nodes)
      const newNode  = { ...data, id, gridCol: pos.col, gridRow: pos.row }
      const newEdges = fromId
        ? [...g.edges, { source: fromId, target: id }]
        : g.edges
      return { ...g, nodes: [...g.nodes, newNode], edges: newEdges }
    })
    setAddModal(null)
  }

  function saveTranslation(nodeId: string, lang: DisplayLang, value: string) {
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => {
        if (n.id !== nodeId) return n
        const translations = { ...n.translations }
        if (value) translations[lang] = value
        else delete translations[lang]
        return { ...n, translations }
      }),
    }))
    // Keep the popup's node in sync so edits reflect immediately
    setNodePopup(p => {
      if (!p || p.node.id !== nodeId) return p
      const translations = { ...p.node.translations }
      if (value) translations[lang] = value
      else delete translations[lang]
      return { ...p, node: { ...p.node, translations } }
    })
  }

  function renameNode(nodeId: string, value: string) {
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => n.id === nodeId ? { ...n, english: value } : n),
    }))
    setRenameModal(null)
  }

  // ── Auto-detect POS via Free Dictionary API (dictionaryapi.dev) ──────────────
  // Maps their partOfSpeech strings to our POS type; unmapped values are skipped.
  const POS_MAP: Record<string, POS> = {
    noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb',
    pronoun: 'pronoun', preposition: 'preposition', conjunction: 'conjunction',
    numeral: 'number', number: 'number', article: 'article', determiner: 'article',
  }

  async function loadPOS() {
    // Only single-word nodes — dictionary API doesn't handle phrases
    const wordNodes = graphRef.current.nodes.filter(n => n.nodeType !== 'note' && !n.english.includes(' '))
    if (wordNodes.length === 0) { setPosStatus('No word nodes on the graph.'); return }

    setLoadingPOS(true)
    setPosStatus(`Looking up 0 / ${wordNodes.length}…`)

    const updates: Record<string, POS> = {}
    for (let i = 0; i < wordNodes.length; i++) {
      const node = wordNodes[i]
      try {
        const res  = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(node.english)}`)
        if (res.ok) {
          const json = await res.json()
          // Pick the partOfSpeech of the first meaning of the first entry
          const raw: string = json?.[0]?.meanings?.[0]?.partOfSpeech ?? ''
          const mapped = POS_MAP[raw.toLowerCase()]
          if (mapped) updates[node.id] = mapped
        }
      } catch { /* skip on network error */ }
      setPosStatus(`Looking up ${i + 1} / ${wordNodes.length}…`)
      if (i < wordNodes.length - 1) await new Promise(r => setTimeout(r, 80))
    }

    const filled = Object.keys(updates).length
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => updates[n.id] ? { ...n, pos: updates[n.id] } : n),
    }))
    setLoadingPOS(false)
    setPosStatus(filled > 0
      ? `✓ Updated ${filled} / ${wordNodes.length} node${wordNodes.length !== 1 ? 's' : ''}`
      : 'No POS data found.')
    setTimeout(() => setPosStatus(null), 4000)
  }

  function handleSuggestionDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!fgRef.current) return
    const raw = e.dataTransfer.getData('application/x-suggestion')
    if (!raw) return
    let s: Suggestion
    try { s = JSON.parse(raw) } catch { return }
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const { x: gx, y: gy } = fgRef.current.screen2GraphCoords(e.clientX - rect.left, e.clientY - rect.top)
    bgClickGridRef.current = pixelToGrid(gx, gy)
    appendFromIdForNew.current = null
    addNode({ english: s.english, pos: s.pos, translations: { en: s.english, ...s.translations } })
  }

  function addNoteNode(text: string) {
    addNode({ nodeType: 'note', english: text, translations: {}, pos: 'noun' })
    setNoteNodeModal(false)
  }

  function removeNode(nodeId: string) {
    setGraph(g => ({
      nodes: g.nodes.filter(n => n.id !== nodeId),
      edges: g.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    }))
  }

  function addEdge(fromId: string, toId: string) {
    setGraph(g => {
      const already = g.edges.some(e =>
        (e.source === fromId && e.target === toId) || (e.source === toId && e.target === fromId)
      )
      return already ? g : { ...g, edges: [...g.edges, { source: fromId, target: toId }] }
    })
  }

  function saveNote(nodeId: string, note: string) {
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => n.id === nodeId ? { ...n, note: note || undefined } : n),
    }))
    setNoteModal(null)
  }

  function setEdgeType(edge: VocabEdge, type: EdgeType) {
    setGraph(g => ({
      ...g,
      edges: g.edges.map(e =>
        (e.source === edge.source && e.target === edge.target) ||
        (e.source === edge.target && e.target === edge.source)
          ? { ...e, type }
          : e
      ),
    }))
  }

  // ── MyMemory lang codes (maps our DisplayLang to the API's langpair codes)
  const XLATE_CODES: Record<DisplayLang, string> = { en: 'en', es: 'es', zh: 'zh-CN', id: 'id' }

  async function loadTranslations() {
    if (!secondaryLang || secondaryLang === 'en') {
      setXlateStatus('Select a non-English subtitle language first.')
      return
    }
    const targetCode = XLATE_CODES[secondaryLang]
    const nodes = graphRef.current.nodes
    const missing = nodes.filter(n => !n.translations[secondaryLang])
    if (missing.length === 0) {
      setXlateStatus('All nodes already have a translation.')
      return
    }

    setXlating(true)
    setXlateStatus(`Translating 0 / ${missing.length}…`)

    const updates: Record<string, string> = {}
    for (let i = 0; i < missing.length; i++) {
      const node = missing[i]
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(node.english)}&langpair=en|${targetCode}`
        const res = await fetch(url)
        const json = await res.json()
        const text: string = json?.responseData?.translatedText ?? ''
        if (text && json?.responseStatus === 200) updates[node.id] = text
      } catch { /* skip on network error */ }
      setXlateStatus(`Translating ${i + 1} / ${missing.length}…`)
      // small delay to avoid hammering the free API
      if (i < missing.length - 1) await new Promise(r => setTimeout(r, 120))
    }

    const filled = Object.keys(updates).length
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n =>
        updates[n.id] && !n.translations[secondaryLang]
          ? { ...n, translations: { ...n.translations, [secondaryLang]: updates[n.id] } }
          : n
      ),
    }))
    setXlating(false)
    setXlateStatus(filled === missing.length
      ? `✓ Translated ${filled} node${filled !== 1 ? 's' : ''}`
      : `✓ ${filled} translated, ${missing.length - filled} failed`)
    setTimeout(() => setXlateStatus(null), 4000)
  }

  function removeEdge(edge: VocabEdge) {
    setGraph(g => ({
      ...g,
      edges: g.edges.filter(e =>
        !((e.source === edge.source && e.target === edge.target) ||
          (e.source === edge.target && e.target === edge.source))
      ),
    }))
  }

  // ── Graph event handlers
  const handleNodeClick = useCallback((node: VocabNode, event: MouseEvent) => {
    // Shift+click: connect mode shortcut
    if (event.shiftKey) {
      if (connectingFromRef.current) {
        // Second shift-click — complete the edge
        const from = connectingFromRef.current
        if (from !== node.id) addEdge(from, node.id)
        connectingFromRef.current = null
        setConnectingFrom(null)
      } else {
        // First shift-click — start connecting from this node
        connectingFromRef.current = node.id
        setConnectingFrom(node.id)
        setNodePopup(null)
        setCtxMenu(null)
      }
      return
    }
    // Connect mode: plain click on a node completes the edge
    if (connectingFromRef.current) {
      const from = connectingFromRef.current
      if (from !== node.id) addEdge(from, node.id)
      connectingFromRef.current = null
      setConnectingFrom(null)
      return
    }
    // Append mode: clicking an existing node cancels the mode
    if (appendingFromRef.current) {
      appendFromIdForNew.current = null
      setAppendingFrom(null)
      return
    }
    setCtxMenu(null)
    setNodePopup({ x: event.clientX, y: event.clientY, node })
  }, [])

  const handleNodeRightClick = useCallback((node: VocabNode, event: MouseEvent) => {
    event.preventDefault()
    setNodePopup(null); setConnectingFrom(null); setAppendingFrom(null)
    appendFromIdForNew.current = null
    setCtxMenu({ x: event.clientX, y: event.clientY, node })
  }, [])

  const handleBgRightClick = useCallback((event: MouseEvent) => {
    event.preventDefault()
    // Cancel any active mode on right-click
    if (connectingFromRef.current) { setConnectingFrom(null); return }
    if (appendingFromRef.current)  { setAppendingFrom(null);  appendFromIdForNew.current = null; return }
    // Store grid position, then show the choice menu
    if (fgRef.current) {
      const gp = fgRef.current.screen2GraphCoords(event.offsetX, event.offsetY)
      bgClickGridRef.current = pixelToGrid(gp.x, gp.y)
    }
    setBgCtxMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const handleBgClick = useCallback((event: MouseEvent) => {
    // Append mode: left-click on canvas places the new node here
    if (appendingFromRef.current) {
      appendFromIdForNew.current = appendingFromRef.current
      if (fgRef.current) {
        const gp = fgRef.current.screen2GraphCoords(event.offsetX, event.offsetY)
        bgClickGridRef.current = pixelToGrid(gp.x, gp.y)
      }
      setAppendingFrom(null)
      setAddModal({})
      return
    }
    // Connect mode: clicking an empty grid spot opens add-node modal and auto-connects
    if (connectingFromRef.current) {
      appendFromIdForNew.current = connectingFromRef.current
      if (fgRef.current) {
        const gp = fgRef.current.screen2GraphCoords(event.offsetX, event.offsetY)
        bgClickGridRef.current = pixelToGrid(gp.x, gp.y)
      }
      setConnectingFrom(null)
      setAddModal({})
      return
    }
    setNodePopup(null); setCtxMenu(null)
  }, [])

  // ── Snap to grid on drag end
  const handleNodeDragEnd = useCallback((node: any) => {
    // Flag so the container onClick knows this mouseup was a drag release, not a click
    wasDragging.current = true
    requestAnimationFrame(() => { wasDragging.current = false })

    const { col, row } = snapToFree(node.x, node.y, graphRef.current.nodes, node.id)
    const { x, y } = gridToPixel(col, row)
    node.x = x; node.y = y; node.fx = x; node.fy = y
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => n.id === node.id ? { ...n, gridCol: col, gridRow: row } : n),
    }))
  }, [])

  // ── Hit-test: find which node (if any) contains graph-space point (gx, gy)
  const findNodeAtPoint = useCallback((gx: number, gy: number): VocabNode | null => {
    for (const node of graphRef.current.nodes) {
      const { x, y } = gridToPixel(node.gridCol, node.gridRow)
      const label   = node.translations[displayLangRef.current] ?? node.translations.en ?? node.english
      const secLang = secondaryLangRef.current
      const sub     = secLang && secLang !== displayLangRef.current ? (node.translations[secLang] ?? '') : ''
      const r = 10 + Math.min(Math.max(label.length, sub.length) * 0.55, 12) + RING_PAD
      if ((gx - x) ** 2 + (gy - y) ** 2 <= r * r) return node
    }
    return null
  }, [])

  // ── Hit-test: find which edge (if any) is close to graph-space point (gx, gy)
  const findEdgeAtPoint = useCallback((gx: number, gy: number): VocabEdge | null => {
    for (const edge of graphRef.current.edges) {
      const src = graphRef.current.nodes.find(n => n.id === edge.source)
      const tgt = graphRef.current.nodes.find(n => n.id === edge.target)
      if (!src || !tgt) continue
      const { x: x1, y: y1 } = gridToPixel(src.gridCol, src.gridRow)
      const { x: x2, y: y2 } = gridToPixel(tgt.gridCol, tgt.gridRow)
      if (ptSegDist(gx, gy, x1, y1, x2, y2) <= EDGE_HIT) return edge
    }
    return null
  }, [])

  // ── Container-level click handlers (bypass d3-drag click suppression)
  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (wasDragging.current || !fgRef.current) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const { x: gx, y: gy } = fgRef.current.screen2GraphCoords(
      e.clientX - rect.left, e.clientY - rect.top,
    )
    const node = findNodeAtPoint(gx, gy)
    if (node) handleNodeClick(node as any, e.nativeEvent)
    else      handleBgClick(e.nativeEvent)
  }, [findNodeAtPoint, handleNodeClick, handleBgClick])

  const handleContainerContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!fgRef.current) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const { x: gx, y: gy } = fgRef.current.screen2GraphCoords(
      e.clientX - rect.left, e.clientY - rect.top,
    )
    const node = findNodeAtPoint(gx, gy)
    if (node) { handleNodeRightClick(node as any, e.nativeEvent); return }
    const edge = findEdgeAtPoint(gx, gy)
    if (edge) { setEdgeCtxMenu({ x: e.clientX, y: e.clientY, edge }); return }
    handleBgRightClick(e.nativeEvent)
  }, [findNodeAtPoint, findEdgeAtPoint, handleNodeRightClick, handleBgRightClick])

  // ── Custom edge drawing — wave patterns along each connection
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const src = link.source, tgt = link.target
    const x1 = src?.x ?? 0, y1 = src?.y ?? 0
    const x2 = tgt?.x ?? 0, y2 = tgt?.y ?? 0
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 2) return

    const ux = dx / len, uy = dy / len   // unit along edge
    const px = -uy,      py = ux         // unit perpendicular

    const type: EdgeType = link.type ?? 'default'
    const meta = EDGE_META[type]
    const lw   = 2.5 / globalScale
    const amp  = 5                        // wave amplitude (graph units)
    const per  = 28                       // wave period (graph units)

    // Inset endpoints so lines don't overdraw the node circles
    const r1  = 10 + Math.min((src?.english?.length ?? 4) * 0.55, 12)
    const r2  = 10 + Math.min((tgt?.english?.length ?? 4) * 0.55, 12)
    const t1  = Math.min(r1 / len, 0.45)
    const t2  = Math.min(r2 / len, 0.45)
    const sx  = x1 + dx * t1,  sy = y1 + dy * t1   // start of drawn line
    const ex  = x2 - dx * t2,  ey = y2 - dy * t2   // end of drawn line
    const elen = len * (1 - t1 - t2)                // length of drawn segment
    if (elen < 2) return

    ctx.save()
    ctx.strokeStyle = meta.color
    ctx.lineWidth   = lw
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'

    if (type === 'default') {
      // ─── plain line
      ctx.beginPath()
      ctx.moveTo(sx, sy); ctx.lineTo(ex, ey)
      ctx.stroke()

    } else if (type === 'synonym') {
      // ≈ smooth sine wave
      ctx.beginPath()
      const steps = Math.max(24, Math.ceil(elen / (per / 8)))
      for (let i = 0; i <= steps; i++) {
        const d = (i / steps) * elen
        const wave = Math.sin((d / per) * 2 * Math.PI) * amp
        const x = sx + ux * d + px * wave
        const y = sy + uy * d + py * wave
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()

    } else if (type === 'antonym') {
      // ⊓ square wave — alternating perpendicular steps
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      const halfP  = per / 2
      const nSegs  = Math.ceil(elen / halfP)
      ctx.lineTo(sx + px * amp, sy + py * amp)   // initial jump to +amp
      let d = 0
      for (let i = 0; i < nSegs; i++) {
        const sign   = i % 2 === 0 ? 1 : -1
        const nextD  = Math.min(d + halfP, elen)
        ctx.lineTo(sx + ux * nextD + px * sign * amp, sy + uy * nextD + py * sign * amp)
        if (nextD < elen) ctx.lineTo(sx + ux * nextD - px * sign * amp, sy + uy * nextD - py * sign * amp)
        d = nextD
      }
      ctx.lineTo(ex, ey)
      ctx.stroke()

    } else if (type === 'category') {
      // ═ double parallel lines
      const off = 3.5 / globalScale
      ctx.beginPath()
      ctx.moveTo(sx + px * off, sy + py * off)
      ctx.lineTo(ex + px * off, ey + py * off)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(sx - px * off, sy - py * off)
      ctx.lineTo(ex - px * off, ey - py * off)
      ctx.stroke()

    } else if (type === 'intensity') {
      // ↗ sawtooth — fast rise, slow fall, repeat
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      const nSaws = Math.ceil(elen / per)
      for (let i = 0; i < nSaws; i++) {
        const d0    = i * per
        const dPeak = Math.min(d0 + per * 0.25, elen)   // rise: 25 % of period
        const dEnd  = Math.min(d0 + per,         elen)
        ctx.lineTo(sx + ux * dPeak + px * amp,  sy + uy * dPeak + py * amp)
        ctx.lineTo(sx + ux * dEnd,               sy + uy * dEnd)
      }
      ctx.stroke()
    }

    ctx.restore()
  }, [])

  // ── Draw triangular grid before each frame
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, globalScale: number) => {
    const canvas   = ctx.canvas
    const tf       = ctx.getTransform()
    const scale    = tf.a || globalScale
    const tx       = tf.e, ty = tf.f

    // Visible area in graph coordinates (with 2-cell padding)
    const gxMin = (-tx / scale) - GRID_W * 2
    const gxMax = ((canvas.width  - tx) / scale) + GRID_W * 2
    const gyMin = (-ty / scale) - GRID_H * 2
    const gyMax = ((canvas.height - ty) / scale) + GRID_H * 2

    const colMin = Math.floor(gxMin / GRID_W) - 1
    const colMax = Math.ceil (gxMax / GRID_W) + 1
    const rowMin = Math.floor(gyMin / GRID_H) - 1
    const rowMax = Math.ceil (gyMax / GRID_H) + 1

    ctx.save()

    // ── Grid lines
    ctx.beginPath()
    ctx.strokeStyle = '#1a2744'
    ctx.lineWidth   = 0.8 / globalScale

    for (let row = rowMin; row <= rowMax; row++) {
      for (let col = colMin; col <= colMax; col++) {
        const { x, y } = gridToPixel(col, row)

        // Right neighbor (horizontal)
        const right = gridToPixel(col + 1, row)
        ctx.moveTo(x, y); ctx.lineTo(right.x, right.y)

        // Down-A neighbor (same col, next row)
        const downA = gridToPixel(col, row + 1)
        ctx.moveTo(x, y); ctx.lineTo(downA.x, downA.y)

        // Down-B neighbor (alternates by row parity to form triangles)
        const downB = (row & 1) === 0
          ? gridToPixel(col - 1, row + 1)
          : gridToPixel(col + 1, row + 1)
        ctx.moveTo(x, y); ctx.lineTo(downB.x, downB.y)
      }
    }
    ctx.stroke()

    // ── Lattice rings — hollow circles that read as right-click targets
    const dotR  = 4 / globalScale   // inner filled dot
    const ringR = 9 / globalScale   // outer ring
    ctx.lineWidth = 1 / globalScale

    for (let row = rowMin; row <= rowMax; row++) {
      for (let col = colMin; col <= colMax; col++) {
        const { x, y } = gridToPixel(col, row)

        // Outer ring
        ctx.beginPath()
        ctx.arc(x, y, ringR, 0, 2 * Math.PI)
        ctx.strokeStyle = '#243560'
        ctx.stroke()

        // Inner dot
        ctx.beginPath()
        ctx.arc(x, y, dotR, 0, 2 * Math.PI)
        ctx.fillStyle = '#203060'
        ctx.fill()
      }
    }

    // ── Origin marker (slightly brighter)
    ctx.beginPath()
    ctx.arc(0, 0, ringR, 0, 2 * Math.PI)
    ctx.strokeStyle = '#3b6ba8'
    ctx.lineWidth = 1.5 / globalScale
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, dotR, 0, 2 * Math.PI)
    ctx.fillStyle = '#2d4a7a'
    ctx.fill()

    ctx.restore()
  }, [])

  // ── Custom node canvas drawing
  const paintNode = useCallback((
    node: VocabNode & { x?: number; y?: number },
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => {
    const isNote = node.nodeType === 'note'
    const color  = isNote ? '#f59e0b' : (POS_COLOR[node.pos] ?? '#6b7280')
    const x = node.x ?? 0, y = node.y ?? 0

    // Note nodes show their text directly; word nodes show the selected translation
    const title    = isNote
      ? node.english
      : (node.translations[displayLangRef.current] ?? node.translations.en ?? node.english)
    const secLang  = secondaryLangRef.current
    const subtitle = (!isNote && secLang && secLang !== displayLangRef.current)
      ? (node.translations[secLang] ?? null)
      : null

    // Radius sized to the wider of the two labels; note nodes get a touch more padding
    const longestLen = Math.max(title.length, subtitle?.length ?? 0)
    const r   = (isNote ? 13 : 10) + Math.min(longestLen * 0.55, 12)
    const fs  = Math.max(10, 13 / globalScale)   // title font size
    const sfs = Math.max(8,  10 / globalScale)   // subtitle font size

    // Outer ring — expands the visible click target
    ctx.beginPath()
    ctx.arc(x, y, r + RING_PAD, 0, 2 * Math.PI)
    ctx.strokeStyle = color + '18'
    ctx.lineWidth = 1.5 / globalScale
    ctx.stroke()

    // Dashed yellow ring for connection-source / append-source node
    if (connectingFromRef.current === node.id || appendingFromRef.current === node.id) {
      ctx.beginPath()
      ctx.arc(x, y, r + RING_PAD + 4 / globalScale, 0, 2 * Math.PI)
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 2 / globalScale
      ctx.setLineDash([4 / globalScale, 3 / globalScale])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Node circle
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color + '18'
    ctx.fill()
    // Note nodes get a dashed border to distinguish them from word nodes
    if (isNote) ctx.setLineDash([3 / globalScale, 2 / globalScale])
    ctx.strokeStyle = color + '66'
    ctx.lineWidth = isNote ? 1.5 / globalScale : 1 / globalScale
    ctx.stroke()
    ctx.setLineDash([])

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

    if (subtitle) {
      // Two-line: shift title up, subtitle below
      const halfGap = sfs * 0.55
      ctx.font = `600 ${fs}px sans-serif`
      ctx.fillStyle = '#f3f4f6'
      ctx.fillText(title, x, y - halfGap)

      ctx.font = `${sfs}px sans-serif`
      ctx.fillStyle = '#cbd5e1'
      ctx.fillText(subtitle, x, y + halfGap)
    } else {
      // Single line centred — note nodes in amber tint
      ctx.font = `${isNote ? '' : '600 '}${fs}px sans-serif`
      ctx.fillStyle = isNote ? '#fcd34d' : '#f3f4f6'
      ctx.fillText(title, x, y)
    }

    // Note text below the node
    if (node.note) {
      const noteFs = Math.max(7, 9 / globalScale)
      const maxW   = 110 / globalScale
      ctx.font = `italic ${noteFs}px sans-serif`
      ctx.fillStyle = '#64748b'
      let noteText = node.note
      while (noteText.length > 3 && ctx.measureText(noteText).width > maxW)
        noteText = noteText.slice(0, -4) + '…'
      ctx.fillText(noteText, x, y + r + noteFs * 1.4)
    }
  }, [])

  // ── Hit-area painter — fills a circle matching the visual ring so clicks register on it
  const paintNodeArea = useCallback((
    node: VocabNode & { x?: number; y?: number },
    color: string,
    ctx: CanvasRenderingContext2D,
  ) => {
    const title   = node.translations[displayLangRef.current] ?? node.translations.en ?? node.english
    const secLang = secondaryLangRef.current
    const sub     = secLang && secLang !== displayLangRef.current ? node.translations[secLang] ?? '' : ''
    const x = node.x ?? 0, y = node.y ?? 0
    const r = 10 + Math.min(Math.max(title.length, sub.length) * 0.55, 12) + RING_PAD
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [])

  // ── graphData — nodes pinned to grid via fx/fy; simulation disabled
  const graphData = useMemo(() => ({
    nodes: graph.nodes.map(n => {
      const { x, y } = gridToPixel(n.gridCol, n.gridRow)
      return { ...n, x, y, fx: x, fy: y }
    }),
    links: graph.edges.map(e => ({ source: e.source, target: e.target, type: e.type ?? 'default' })),
  }), [graph])

  // ── Derived
  const existingEnglish = new Set(graph.nodes.map(n => n.english.toLowerCase()))
  const suggestions = ALL_SUGGESTIONS.filter(s =>
    !existingEnglish.has(s.english.toLowerCase()) &&
    (!search || s.english.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex-none px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white transition" aria-label="Home">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-base font-semibold">Vocabulary Graph</h1>
            <p className="text-gray-500 text-xs">Left-click to inspect · right-click node for options · right-click canvas to add · drag to move</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(POS_COLOR).map(([pos, color]) => (
            <div key={pos} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-xs text-gray-500">{pos}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 ml-2 border-l border-gray-800 pl-3">
            <button
              onClick={loadPOS}
              disabled={loadingPOS}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingPOS ? posStatus : 'Load parts of speech'}
            </button>
            {!loadingPOS && posStatus && (
              <span className="text-xs text-gray-500">{posStatus}</span>
            )}
          </div>
          <span className="text-xs text-gray-700">{graph.nodes.length} nodes</span>
        </div>
      </div>

      {/* Mode banner — append only (connect mode uses yellow ring silently) */}
      {appendingFrom && (
        <div className="flex-none bg-yellow-950/60 border-b border-yellow-800/50 px-5 py-2 flex items-center justify-between">
          <span className="text-yellow-300 text-sm font-medium">
            ✦ Click anywhere on the grid to place a new connected node — or press <kbd className="bg-yellow-900/50 px-1.5 py-0.5 rounded text-xs">Esc</kbd> to cancel
          </span>
          <button
            onClick={() => { setConnectingFrom(null); setAppendingFrom(null); appendFromIdForNew.current = null }}
            className="text-yellow-600 hover:text-yellow-400 text-xs transition ml-4 shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Graph canvas — clicks handled at div level to bypass d3-drag suppression */}
        <div
          ref={containerRef}
          className="flex-1 min-w-0 relative"
          onClick={handleContainerClick}
          onContextMenu={handleContainerContextMenu}
          onDragOver={e => e.preventDefault()}
          onDrop={handleSuggestionDrop}
        >
          {loaded && (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              nodeId="id"
              nodeLabel={() => ''}
              nodeCanvasObject={paintNode as any}
              nodeCanvasObjectMode={() => 'replace'}
              nodePointerAreaPaint={paintNodeArea as any}
              onNodeDragEnd={handleNodeDragEnd}
              onRenderFramePre={drawGrid as any}
              linkCanvasObject={paintLink as any}
              linkCanvasObjectMode={() => 'replace'}
              backgroundColor="#030712"
              width={containerRef.current?.clientWidth}
              height={containerRef.current?.clientHeight}
              enableNodeDrag
              enableZoomInteraction
              enablePanInteraction
              // Disable physics — nodes are pinned to grid via fx/fy
              cooldownTicks={0}
              warmupTicks={0}
              d3AlphaDecay={1}
              d3VelocityDecay={1}
            />
          )}
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600">Loading…</div>
          )}
          {loaded && graph.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <div className="text-5xl">🌐</div>
              <p className="text-gray-500 text-sm text-center">
                Right-click anywhere on the grid to add your first word,<br />
                or pick one from the sidebar →
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-none border-l border-gray-800 flex flex-col bg-gray-950">

          {/* Title language */}
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Title language</p>
            <div className="grid grid-cols-2 gap-1.5">
              {DISPLAY_LANGS.map(l => (
                <button key={l.code} onClick={() => setDisplayLang(l.code)}
                  className={`py-2 rounded-lg text-sm font-medium transition ${displayLang === l.code ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}>
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle language */}
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Subtitle language</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setSecondaryLang(null)}
                className={`py-2 rounded-lg text-sm font-medium transition ${secondaryLang === null ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
              >
                — None
              </button>
              {DISPLAY_LANGS.map(l => (
                <button key={l.code} onClick={() => setSecondaryLang(l.code)}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
                    secondaryLang === l.code
                      ? 'bg-gray-700 text-white'
                      : l.code === displayLang
                        ? 'text-gray-700 cursor-default'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}>
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
            {secondaryLang && secondaryLang !== 'en' && (
              <div className="mt-2.5">
                <button
                  onClick={loadTranslations}
                  disabled={xlating}
                  className="w-full py-1.5 rounded-lg text-xs font-medium transition bg-blue-900/40 border border-blue-800/50 text-blue-300 hover:bg-blue-800/50 hover:text-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {xlating ? xlateStatus : 'Load translations'}
                </button>
                {!xlating && xlateStatus && (
                  <p className="text-xs text-center mt-1.5 text-gray-500">{xlateStatus}</p>
                )}
              </div>
            )}
          </div>

          <div className="px-4 pt-3 pb-2 border-b border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Suggested words</p>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {suggestions.slice(0, 120).map(s => (
              <button key={s.english}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/x-suggestion', JSON.stringify(s))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => { bgClickGridRef.current = null; setAddModal({ suggestion: s }) }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-800/50 transition group border-b border-gray-800/50 cursor-grab active:cursor-grabbing active:opacity-50">
                <div className="text-left min-w-0">
                  <span className="text-sm text-gray-200 group-hover:text-white transition">{s.english}</span>
                  <span className="text-xs text-gray-600 ml-2">{s.translations.es ?? s.translations.zh ?? s.translations.id ?? ''}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-2 h-2 rounded-full" style={{ background: POS_COLOR[s.pos] }} />
                  <span className="text-xs text-gray-700">{s.pos}</span>
                  <span className="text-gray-600 opacity-0 group-hover:opacity-100 transition text-xs ml-1">⋮⋮</span>
                </div>
              </button>
            ))}
            {suggestions.length === 0 && <p className="text-center text-gray-600 text-sm py-8">{search ? 'No matches' : 'All words added!'}</p>}
            {suggestions.length > 120 && <p className="text-center text-gray-600 text-xs py-3">Search to narrow results ({suggestions.length} total)</p>}
          </div>
        </div>
      </div>

      {/* Modals & overlays */}
      {addModal !== null && (
        <AddWordModal suggestion={addModal.suggestion} onAdd={addNode} onClose={() => {
          bgClickGridRef.current = null
          appendFromIdForNew.current = null
          setAddModal(null)
        }} />
      )}
      {noteModal && (
        <NoteModal node={noteModal} onSave={note => saveNote(noteModal.id, note)} onClose={() => setNoteModal(null)} />
      )}
      {nodePopup && (
        <NodePopup x={nodePopup.x} y={nodePopup.y} node={nodePopup.node} onClose={() => setNodePopup(null)}
          onSaveTranslation={(lang, value) => saveTranslation(nodePopup.node.id, lang, value)} />
      )}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y} label={labelFor(ctxMenu.node)} hasNote={!!ctxMenu.node.note}
          onConnect={() => {
            setConnectingFrom(ctxMenu.node.id)
            connectingFromRef.current = ctxMenu.node.id
          }}
          onAppend={() => {
            setAppendingFrom(ctxMenu.node.id)
            appendingFromRef.current = ctxMenu.node.id
          }}
          onNote={() => setNoteModal(ctxMenu.node)}
          onRename={() => setRenameModal(ctxMenu.node)}
          onRemove={() => removeNode(ctxMenu.node.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {edgeCtxMenu && (
        <EdgeContextMenu
          x={edgeCtxMenu.x} y={edgeCtxMenu.y} edge={edgeCtxMenu.edge}
          onSetType={type => { setEdgeType(edgeCtxMenu.edge, type); setEdgeCtxMenu(null) }}
          onRemove={() => { removeEdge(edgeCtxMenu.edge); setEdgeCtxMenu(null) }}
          onClose={() => setEdgeCtxMenu(null)}
        />
      )}
      {bgCtxMenu && (
        <BgContextMenu
          x={bgCtxMenu.x} y={bgCtxMenu.y}
          onAddWord={() => setAddModal({})}
          onAddNote={() => setNoteNodeModal(true)}
          onClose={() => setBgCtxMenu(null)}
        />
      )}
      {noteNodeModal && (
        <AddNoteNodeModal
          onAdd={addNoteNode}
          onClose={() => { setNoteNodeModal(false); bgClickGridRef.current = null }}
        />
      )}
      {renameModal && (
        <RenameModal
          node={renameModal}
          onSave={value => renameNode(renameModal.id, value)}
          onClose={() => setRenameModal(null)}
        />
      )}
    </div>
  )
}
