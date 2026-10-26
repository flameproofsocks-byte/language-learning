// POST /api/transcribe  (multipart: file, lang)  — start a local Whisper transcription job
//
// Saves the upload to a temp job dir and spawns scripts/transcribe.py (faster-whisper in
// .venv-whisper) detached, then returns { id } immediately. Transcription can take minutes,
// so the client polls GET /api/transcribe/[id] for progress and segments.
// Set WHISPER_MODEL (tiny | base | small | medium | large-v3) to trade speed for accuracy.

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import path from 'path'
import { JOBS_DIR } from '@/lib/transcribe-jobs'

const MAX_BYTES = 200 * 1024 * 1024
const JOB_TTL_MS = 24 * 60 * 60 * 1000
const LANGS = ['es', 'zh', 'id']

async function pruneOldJobs() {
  try {
    for (const name of await fs.readdir(JOBS_DIR)) {
      const dir = path.join(JOBS_DIR, name)
      const { mtimeMs } = await fs.stat(dir)
      if (Date.now() - mtimeMs > JOB_TTL_MS) await fs.rm(dir, { recursive: true, force: true })
    }
  } catch { /* jobs dir doesn't exist yet */ }
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file')
  const lang = String(form.get('lang') ?? '')

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No audio file uploaded' }, { status: 400 })
  }
  if (!LANGS.includes(lang)) {
    return NextResponse.json({ error: 'Unsupported language' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 200 MB)' }, { status: 413 })
  }

  await pruneOldJobs()

  const id = randomUUID()
  const dir = path.join(JOBS_DIR, id)
  await fs.mkdir(dir, { recursive: true })
  // ffmpeg (via PyAV) sniffs the real format, so the extension is only a hint.
  const ext = path.extname(file.name).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 8) || '.audio'
  const audioPath = path.join(dir, `audio${ext}`)
  await fs.writeFile(audioPath, Buffer.from(await file.arrayBuffer()))

  await fs.writeFile(
    path.join(dir, 'status.json'),
    JSON.stringify({ status: 'loading', progress: 0, segments: [], error: null }),
  )

  const python = path.join(process.cwd(), '.venv-whisper', 'bin', 'python')
  const script = path.join(process.cwd(), 'scripts', 'transcribe.py')
  const child = spawn(
    python,
    [script, audioPath, lang, dir, process.env.WHISPER_MODEL ?? 'small'],
    { detached: true, stdio: 'ignore' },
  )
  child.on('error', err => {
    // e.g. venv missing — report through the same channel the UI already polls
    fs.writeFile(
      path.join(dir, 'status.json'),
      JSON.stringify({ status: 'error', progress: 0, segments: [], error: `Could not start Whisper: ${err.message}` }),
    ).catch(() => {})
  })
  child.unref()

  return NextResponse.json({ id })
}
