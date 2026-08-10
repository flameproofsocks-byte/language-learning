# Running Locally

## Prerequisites

- **Node.js** v18 or later (`node --version`)
- **npm** v9 or later (comes with Node)

No database, Docker, or external services required. Knowledge data is stored as plain JSON files in the `data/` directory.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

The app starts at **http://localhost:8686**.

> The first page load after startup takes ~30–45 seconds while Turbopack compiles. Subsequent navigations are fast.

## Helper Scripts

Two convenience scripts are provided so the server can be started/stopped from anywhere on the machine:

```bash
# Start (skips if already running)
./start-language-tool.sh

# Stop
./stop-language-tool.sh
```

Both scripts use absolute paths internally, so they work regardless of your current working directory:

```bash
bash /path/to/language-learning/start-language-tool.sh
```

The dev server PID is saved to `/tmp/language-learning-dev.pid` and logs go to `/tmp/language-learning-dev.log`.

## Other npm Commands

```bash
npm run build    # production build (output in .next/)
npm run start    # serve the production build on port 8686
```

## Knowledge Data

User progress is persisted in `data/`:

```
data/
  knowledge_es.json   # Spanish progress
  knowledge_zh.json   # Mandarin progress
  knowledge_id.json   # Indonesian progress
```

These files are created automatically on first use. They store word levels (1–4), session statistics, and personal notes. To reset progress for a language, delete the corresponding file.

## Speech Recognition

The microphone button in Word Testing uses the browser's native **Web Speech API** and requires:

- A Chromium-based browser (Chrome, Edge, Brave) — Firefox does not support this API
- Microphone permission granted in the browser
- No additional setup or API keys

## Translate API

The Load Text page can look up unknown words via `GET /api/translate`. This calls the **Google Translate unofficial endpoint** (`translate.googleapis.com`) with no API key. If that endpoint becomes unavailable, translation lookups will silently fail and the UI will fall back to the built-in word list.
