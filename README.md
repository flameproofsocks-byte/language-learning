# Language Learning

A vocabulary-building web app with spaced-repetition testing, a D3 knowledge graph, sentence games, and a memory card game. Supports **Spanish**, **Mandarin** (pinyin), and **Indonesian**.

## Features

| Feature | Description |
|---|---|
| **Word Testing** | Multi-round selection + verification flow. Words are promoted/demoted through 4 knowledge levels based on performance. |
| **Dragon Sentence Game** | Tile-based sentence construction with HP bars, wager mechanics, and hint system. |
| **Memory Game** | Timed card-matching game pairing foreign words with English meanings. |
| **Knowledge Graph** | Interactive D3 force graph of encountered words and their semantic relationships (antonyms, synonyms, categories, domains). Click any node to add a personal memory tip. |
| **Vocabulary Graph** | Freeform canvas for building a personal vocabulary knowledge graph. Add single words or phrases as nodes, connect them with typed edges (synonym, antonym, category, intensity), and store translations per node. Supports drag-and-drop from a sidebar word list, auto-translation via MyMemory, auto POS detection via Free Dictionary API, and inline translation editing. |
| **Load Text** | Paste any target-language text; click words to see inline translations. |
| **Speech Input** | Microphone button in Word Testing uses the Web Speech API to transcribe spoken English answers. |

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Graph:** D3.js v7
- **Storage:** JSON files on disk (server) + localStorage (client cache)

## Quick Start

See [RUNNING_LOCALLY.md](./RUNNING_LOCALLY.md) for full setup instructions.

```bash
npm install
npm run dev    # starts on http://localhost:8686
```

## Android App

A companion React Native/Expo app covering Indonesian word testing and the Dragon Game. See [ANDROID.md](./ANDROID.md).

## Project Structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full walkthrough of the codebase.

## Adding a New Language

1. Create `lib/<lang>.ts` exporting a `Word[]` array
2. Add sentences to `lib/sentences.ts` and update `sentencesFor()`
3. Register the language code in `lib/language.ts` (`Language` union, `LANGUAGE_NAMES`, `LANGUAGE_FLAGS`)
4. Add a branch in `wordsFor()` in `lib/language-data.ts`

## Data Persistence

Knowledge state is stored per-language in `data/knowledge_<lang>.json` on the server and cached in `localStorage` on the client. Notes (memory tips written on graph nodes) live in the same file under the `notes` key.
