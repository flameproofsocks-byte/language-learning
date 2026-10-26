// Shared by the /api/transcribe routes: where transcription jobs live on disk.

import os from 'os'
import path from 'path'

export const JOBS_DIR = path.join(os.tmpdir(), 'langlearn-transcribe')

export interface Segment { start: number; end: number; text: string }

export interface TranscribeStatus {
  status: 'loading' | 'running' | 'done' | 'error'
  progress: number
  segments: Segment[]
  error: string | null
}

// ── Playlist jobs (scripts/playlist.py) ──────────────────────────────────────

export const PLAYLISTS_DIR = path.join(os.tmpdir(), 'langlearn-playlists')

export interface PlaylistSong {
  id: string                 // zero-padded playlist position, e.g. "001"
  title: string
  state: 'pending' | 'downloaded' | 'downloading' | 'transcribing' | 'done' | 'error'
  progress: number
  error: string | null
}

export interface PlaylistStatus {
  status: 'starting' | 'running' | 'done' | 'error'
  error: string | null
  songs: PlaylistSong[]
}
