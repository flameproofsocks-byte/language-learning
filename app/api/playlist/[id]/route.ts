// GET /api/playlist/[id]  — poll a playlist job
// Returns { status, error, songs: [{ id, title, state, progress, error }] }.

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { PLAYLISTS_DIR } from '@/lib/transcribe-jobs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 })
  }
  try {
    const raw = await fs.readFile(path.join(PLAYLISTS_DIR, id, 'status.json'), 'utf-8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
}
