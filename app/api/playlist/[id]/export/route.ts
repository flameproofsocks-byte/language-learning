// GET /api/playlist/[id]/export?lang=<lang>  — download a zip of audio + transcripts
//
// For every finished song <id> (zero-padded playlist position):
//   <id>.mp3          the audio
//   <id>.<lang>.txt   native-language transcript, one timestamped line per segment
//   <id>.en.txt       English transcript with the SAME timestamps
// plus playlist.json, the manifest that ties them together (see ANDROID_PLAYLIST_PLAYER_SPEC.txt).
// English is translated on first export (via lib/translate) and cached in the job dir, so
// re-downloading is instant.

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import JSZip from 'jszip'
import { PLAYLISTS_DIR, type PlaylistStatus, type Segment } from '@/lib/transcribe-jobs'
import { translateMany } from '@/lib/translate'

function ts(t: number): string {
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(2).padStart(5, '0')
  return `${String(m).padStart(2, '0')}:${s}`
}

function render(segs: Segment[], texts: (string | null)[]): string {
  return segs.map((s, i) => `[${ts(s.start)} --> ${ts(s.end)}] ${texts[i] ?? ''}`).join('\n') + '\n'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const lang = new URL(req.url).searchParams.get('lang') ?? 'es'
  if (!/^[0-9a-f-]{36}$/.test(id) || !['es', 'zh', 'id'].includes(lang)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const dir = path.join(PLAYLISTS_DIR, id)
  let status: PlaylistStatus
  try {
    status = JSON.parse(await fs.readFile(path.join(dir, 'status.json'), 'utf-8'))
  } catch {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const zip = new JSZip()
  const manifest: {
    id: string; title: string; duration: number | null; audio: string | null
    transcripts: { native: string; english: string }
    line_count: number; english_complete: boolean
  }[] = []

  for (const song of status.songs.filter(s => s.state === 'done')) {
    const { segments, duration } = JSON.parse(
      await fs.readFile(path.join(dir, 'songs', `${song.id}.json`), 'utf-8'),
    ) as { segments: Segment[]; duration?: number | null }

    const cachePath = path.join(dir, 'songs', `${song.id}.en.json`)
    let english: (string | null)[]
    try {
      english = JSON.parse(await fs.readFile(cachePath, 'utf-8'))
    } catch {
      english = await translateMany(segments.map(s => s.text), lang)
      // Only cache complete translations, so a flaky Google call is retried next export.
      if (english.every((t, i) => t || !segments[i].text.trim())) {
        await fs.writeFile(cachePath, JSON.stringify(english))
      }
    }

    // Audio is stored as audio/<id>.mp3 by playlist.py. Jobs from before audio was kept have none.
    const audioFile = `${song.id}.mp3`
    let audio: Buffer | null = null
    try { audio = await fs.readFile(path.join(dir, 'audio', audioFile)) } catch { /* no audio kept */ }

    const nativeFile = `${song.id}.${lang}.txt`
    const englishFile = `${song.id}.en.txt`
    zip.file(nativeFile, render(segments, segments.map(s => s.text)))
    zip.file(englishFile, render(segments, english))
    // mp3 is already compressed, so store it as-is instead of wasting CPU on DEFLATE.
    if (audio) zip.file(audioFile, audio, { compression: 'STORE' })
    manifest.push({
      id: song.id,
      title: song.title,
      duration: duration ?? null,
      audio: audio ? audioFile : null,
      transcripts: { native: nativeFile, english: englishFile },
      line_count: segments.length,
      english_complete: english.every((t, i) => t || !segments[i].text.trim()),
    })
  }

  if (manifest.length === 0) {
    return NextResponse.json({ error: 'No finished songs to export yet' }, { status: 409 })
  }
  zip.file('playlist.json', JSON.stringify({
    version: 1,
    language: lang,
    translation_language: 'en',
    exported_at: new Date().toISOString(),
    songs: manifest,
  }, null, 2))

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="playlist-${lang}.zip"`,
    },
  })
}
