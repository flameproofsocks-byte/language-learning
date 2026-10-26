// POST /api/playlist  — start a playlist job; returns { id } immediately.
//   JSON      { url, lang }          YouTube / YouTube Music playlist link
//   multipart { file (.zip), lang }  zip of the user's own audio files
//
// Spawns scripts/playlist.py (same .venv-whisper as /api/transcribe), which gathers the songs
// and transcribes each. Poll GET /api/playlist/[id]; download results from .../export.

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import path from 'path'
import { PLAYLISTS_DIR } from '@/lib/transcribe-jobs'

const MAX_ZIP_BYTES = 1024 * 1024 * 1024
const JOB_TTL_MS = 24 * 60 * 60 * 1000
const LANGS = ['es', 'zh', 'id']

async function pruneOldJobs() {
  try {
    for (const name of await fs.readdir(PLAYLISTS_DIR)) {
      const dir = path.join(PLAYLISTS_DIR, name)
      const { mtimeMs } = await fs.stat(dir)
      if (Date.now() - mtimeMs > JOB_TTL_MS) await fs.rm(dir, { recursive: true, force: true })
    }
  } catch { /* jobs dir doesn't exist yet */ }
}

export async function POST(req: NextRequest) {
  let lang: string
  let mode: 'url' | 'zip'
  let url = ''
  let zip: File | null = null

  if (req.headers.get('content-type')?.includes('application/json')) {
    const body = await req.json() as { url?: string; lang?: string }
    lang = body.lang ?? ''
    mode = 'url'
    url  = (body.url ?? '').trim()
    if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'Enter a playlist link' }, { status: 400 })
  } else {
    const form = await req.formData()
    lang = String(form.get('lang') ?? '')
    mode = 'zip'
    const f = form.get('file')
    if (!(f instanceof File) || f.size === 0) return NextResponse.json({ error: 'No zip uploaded' }, { status: 400 })
    if (f.size > MAX_ZIP_BYTES) return NextResponse.json({ error: 'Zip too large (max 1 GB)' }, { status: 413 })
    zip = f
  }
  if (!LANGS.includes(lang)) return NextResponse.json({ error: 'Unsupported language' }, { status: 400 })

  await pruneOldJobs()

  const id  = randomUUID()
  const dir = path.join(PLAYLISTS_DIR, id)
  await fs.mkdir(dir, { recursive: true })

  let source = url
  if (zip) {
    source = path.join(dir, 'upload.zip')
    await fs.writeFile(source, Buffer.from(await zip.arrayBuffer()))
  }
  await fs.writeFile(
    path.join(dir, 'status.json'),
    JSON.stringify({ status: 'starting', error: null, songs: [] }),
  )

  const python = path.join(process.cwd(), '.venv-whisper', 'bin', 'python')
  const script = path.join(process.cwd(), 'scripts', 'playlist.py')
  const child = spawn(
    python,
    [script, dir, lang, process.env.WHISPER_MODEL ?? 'small', mode, source],
    {
      detached: true,
      stdio: 'ignore',
      // venv bin first on PATH so helper executables installed there resolve
      env: { ...process.env, PATH: `${path.join(process.cwd(), '.venv-whisper', 'bin')}:${process.env.PATH}` },
    },
  )
  child.on('error', err => {
    fs.writeFile(
      path.join(dir, 'status.json'),
      JSON.stringify({ status: 'error', error: `Could not start the playlist job: ${err.message}`, songs: [] }),
    ).catch(() => {})
  })
  child.unref()

  return NextResponse.json({ id })
}
