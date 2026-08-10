# Architecture

## Directory Structure

```
language-learning/
  app/                        # Next.js App Router pages and API routes
    page.tsx                  # Home screen (language selector + game links)
    layout.tsx                # Root HTML layout
    globals.css               # Global Tailwind base styles
    testing/page.tsx          # Word Testing game
    sentence-game/page.tsx    # Dragon Sentence Game
    memory-game/page.tsx      # Memory Card Game
    graph/page.tsx            # Knowledge Graph viewer
    vocab-graph/page.tsx      # Vocabulary Graph — freeform node canvas
    load-text/page.tsx        # Read + translate arbitrary text
    api/
      knowledge/[lang]/route.ts   # GET/POST knowledge JSON per language
      translate/route.ts          # GET word translation via Google Translate (en → target)
      vocab-graph/route.ts        # GET/POST vocabulary graph JSON
  components/
    KnowledgeGraph.tsx        # D3 force-directed graph (client-only, dynamic import)
  lib/
    language.ts               # Language type, names, flags, localStorage helpers
    language-data.ts          # wordsFor(lang) — maps lang code to word list
    words.ts                  # Spanish word list + checkTranslation()
    mandarin.ts               # Mandarin word list (pinyin + characters)
    indonesian.ts             # Indonesian word list
    sentences.ts              # Sentence challenges for all three languages
    relations.ts              # Spanish word relations (for graph edges)
    mandarin-relations.ts     # Mandarin word relations
    knowledge.ts              # KnowledgeBase type, load/save, level helpers
    settings.ts               # User settings (familiarity slider)
  data/
    knowledge_es.json         # Persisted Spanish progress (auto-created)
    knowledge_zh.json         # Persisted Mandarin progress (auto-created)
    knowledge_id.json         # Persisted Indonesian progress (auto-created)
    vocab_graph.json          # Persisted vocabulary graph (auto-created)
  start-language-tool.sh      # Start dev server from anywhere
  stop-language-tool.sh       # Stop dev server
```

## Data Model

### Word

Defined in `lib/words.ts`. All word lists use this same interface:

```ts
interface Word {
  id: string          // unique across all languages (e.g. "w001", "zh006", "id031")
  word: string        // primary display form (Spanish word or pinyin romanization)
  characters?: string // Chinese characters — Mandarin only
  english: string     // primary English translation shown to the user
  aliases: string[]   // additional accepted answers for verification
  pos: PartOfSpeech   // verb | noun | adjective | adverb | pronoun | preposition | conjunction
  rank: number        // frequency rank — lower = more common, drives word selection order
}
```

### KnowledgeBase

Defined in `lib/knowledge.ts`. One JSON file per language stored in `data/`:

```ts
interface KnowledgeBase {
  words: Record<string, WordRecord>  // keyed by word ID
  notes: Record<string, string>      // keyed by word ID — freeform memory tips
  updatedAt: string                  // ISO timestamp of last save
}

interface WordRecord {
  wordId: string
  level: 1 | 2 | 3 | 4  // 1=Unknown, 2=Seen, 3=Familiar, 4=Known
  timesShown: number
  timesCorrect: number
  lastSeen: string
}
```

### SentenceChallenge

Defined in `lib/sentences.ts`:

```ts
interface SentenceChallenge {
  id: string
  english: string       // prompt shown to the user
  answer: string[]      // correct word order (each token is one tile)
  hints: Record<string, string>  // token → hint text shown on tiles
}
```

## Knowledge Levels

```
1 – Unknown    Gray    Never encountered or consistently wrong
2 – Seen       Red     Appeared but not claimed as known
3 – Familiar   Amber   Claimed to know, not yet verified
4 – Known      Green   Claimed AND verified by typing the translation
```

Words advance and regress through these levels based on game performance. The graph only shows words at level 2+.

## Persistence Flow

```
User plays game
      ↓
bulkSetLevel() / setLevel() — produces new KnowledgeBase in memory
      ↓
saveKnowledge(kb, lang)
  ├── localStorage.setItem(...)     ← instant cache update
  └── POST /api/knowledge/[lang]   ← server writes data/knowledge_<lang>.json
      ↓
Page reload / new session
  ├── fetchKnowledge(lang)          ← GET /api/knowledge/[lang]
  └── falls back to loadKnowledge() ← localStorage if server unreachable
```

## Adding a Language

1. **Word list** — create `lib/<code>.ts` with `export const <LANG>_WORDS: Word[]`
   - Use IDs like `xx001`, `xx002`, ...
   - No tones or special scripts required — pinyin-style romanization works

2. **Sentences** — add `export const <LANG>_SENTENCES: SentenceChallenge[]` to `lib/sentences.ts` and update `sentencesFor()`:
   ```ts
   export function sentencesFor(lang: Language): SentenceChallenge[] {
     if (lang === 'zh') return MANDARIN_SENTENCES
     if (lang === 'id') return INDONESIAN_SENTENCES
     if (lang === 'xx') return <LANG>_SENTENCES   // add here
     return SPANISH_SENTENCES
   }
   ```

3. **Language registry** — update `lib/language.ts`:
   ```ts
   export type Language = 'es' | 'zh' | 'id' | 'xx'
   export const LANGUAGE_NAMES = { ..., xx: 'My Language' }
   export const LANGUAGE_FLAGS = { ..., xx: '🏳' }
   ```

4. **Word router** — update `lib/language-data.ts`:
   ```ts
   export function wordsFor(lang: Language): Word[] {
     if (lang === 'zh') return MANDARIN_WORDS
     if (lang === 'id') return INDONESIAN_WORDS
     if (lang === 'xx') return <LANG>_WORDS   // add here
     return SPANISH_WORDS
   }
   ```

5. **Home page** — add `'xx'` to the `LANGUAGES` array in `app/page.tsx`.

6. **Word relations (optional)** — create `lib/<code>-relations.ts` and update `KnowledgeGraph.tsx` to select it.

## Game Logic Summaries

### Word Testing (`app/testing/page.tsx`)

Four-phase flow:
1. **Selection rounds** (×4) — show 4 random words, user clicks the ones they know
2. **Verification** — show up to 5 claimed words one at a time; user types the English translation
3. **Scoring** — not-claimed → level 2; claimed+verified → level 4; claimed+not-verified → level 3
4. **Summary** — display outcomes, link to graph

Word selection prioritises words with low knowledge levels, with light randomisation.

### Dragon Sentence Game (`app/sentence-game/page.tsx`)

- Sentences are scored by the fraction of their words the user knows (levels ≥3)
- `orderByFamiliarity()` selects sentences closest to the user's familiarity setting (0–100)
- Tile pool = correct answer tokens + 5 random distractor words from the word list
- **Wager** costs HP but doubles damage/healing
- **Reveal hint** costs HP and shows the translation of each unrevealed tile

### Knowledge Graph (`components/KnowledgeGraph.tsx`)

- Pure D3 force simulation rendered on an SVG
- Only words at level ≥2 appear as nodes
- Node size scales with knowledge level (radius 20 → 26 → 32)
- Edges come from `WORD_RELATIONS` / `MANDARIN_RELATIONS_MAP`
- An amber dot on a node means a note exists for that word
- Click a node (without dragging) to open the note panel in the parent page

## API Routes

### `GET /api/knowledge/[lang]`
Returns the knowledge JSON for the given language code. Returns `{ words: {}, notes: {}, updatedAt }` if no file exists yet.

### `POST /api/knowledge/[lang]`
Writes the request body as the knowledge JSON. Called by `saveKnowledge()` after every game session.

### `GET /api/translate?word=<word>&lang=<lang>`
Calls the unofficial Google Translate endpoint (`gtx` client, no API key) and returns `{ translation: string | null }`. Translates **from English** into the target language (`es`, `zh`→`zh-CN`, `id`). Handles single words and multi-word phrases. Falls back to `null` on error.

### `GET /api/vocab-graph`
Returns the saved vocabulary graph JSON (`{ nodes, edges }`). Returns `{ nodes: [], edges: [] }` if no file exists yet.

### `POST /api/vocab-graph`
Writes the full graph JSON to `data/vocab_graph.json`. Called by the debounced auto-save in the Vocabulary Graph page (800 ms after any change).

---

## Vocabulary Graph

`app/vocab-graph/page.tsx` — a standalone canvas built on `react-force-graph-2d` (Canvas 2D rendering) with physics fully disabled so nodes stay pinned to a triangular lattice grid.

### Node types

| Type | `nodeType` | Colour | Description |
|---|---|---|---|
| Word / phrase | `'word'` (default) | POS colour | A vocabulary entry with translations per language |
| Note | `'note'` | Amber `#f59e0b` | Freeform text note; dashed border; no POS |

### Edge types

| Type | Visual | Meaning |
|---|---|---|
| `default` | Plain line | General connection |
| `synonym` | Sine wave | Similar meaning |
| `antonym` | Square wave | Opposite meaning |
| `category` | Double line | Belongs to category |
| `intensity` | Sawtooth wave | Degree / intensity |

### Grid system

Nodes sit on an equilateral triangular lattice stored as `(gridCol, gridRow)` integer pairs. `gridToPixel()` and `pixelToGrid()` convert between grid coords and canvas graph-space coordinates. Nodes are pinned via `fx`/`fy` with the D3 simulation set to `cooldownTicks=0` / `d3AlphaDecay=1`.

### Interactions

| Gesture | Action |
|---|---|
| Left-click node | Translation popup with inline editing per language |
| Right-click node | Context menu: connect, append, note, rename, remove |
| Right-click canvas | Choice menu: add word/phrase node or add note node |
| Shift-click node | Enter connect mode (yellow ring); click another node or empty cell to connect |
| Drag node | Snap to nearest free grid cell on release |
| Drag sidebar word | Drop onto canvas to place at that grid position |

### Auto-features

- **Load translations** — fetches missing translations from [MyMemory](https://api.mymemory.translated.net/) for all nodes in the selected subtitle language
- **Load parts of speech** — fetches POS from [Free Dictionary API](https://api.dictionaryapi.dev/) for single-word nodes
- **Auto-translate (modal)** — `⟳` button calls `/api/translate` for each language individually; **⟳ Translate all** fires all three in parallel

### Persistence

Graph state is debounced-saved (800 ms) to both `localStorage` and `data/vocab_graph.json` via `POST /api/vocab-graph`. On load, the server file takes precedence if it has nodes; otherwise falls back to `localStorage`.

### Key implementation notes

- **Click handling**: `react-force-graph-2d` wraps D3-drag which swallows click events on any mouse movement. All clicks are handled at the container `<div>` level via `findNodeAtPoint()` and `findEdgeAtPoint()` hit-test functions rather than the graph library's callbacks.
- **Ref snapshots before `setGraph`**: React 18 strict mode calls `setState` updaters twice in development. Refs (`bgClickGridRef`, `appendFromIdForNew`) are captured as local variables *before* entering the updater so the second invocation gets the same values.
- **Stable canvas callbacks**: `useCallback(fn, [])` callbacks access live state via refs (`graphRef`, `displayLangRef`, `secondaryLangRef`, etc.) to avoid stale closures without triggering re-renders.

## Key Design Decisions

- **No database** — JSON files are simple, portable, and easily backed up or reset. For multi-user support a database would be needed.
- **localStorage cache** — avoids a loading flash on page transitions; the server file is the source of truth.
- **Dynamic import for KnowledgeGraph** — D3 uses browser APIs unavailable in Node; `dynamic(() => import(...), { ssr: false })` prevents SSR errors.
- **`wordsFor()` helper** — centralises the language→word-list mapping so each page doesn't need to import all three word lists.
- **Sentence familiarity scoring** — sentences are ranked by what fraction of their tokens the user already knows, then sorted to match the user's familiarity preference. This means beginners get simpler sentences and advanced users get harder ones automatically.
