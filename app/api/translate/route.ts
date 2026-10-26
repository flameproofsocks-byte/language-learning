// Translate API — used by the Load Text page to translate foreign text into English.
//
// GET  /api/translate?word=<text>&lang=<lang>   → { translation: string | null }
// POST /api/translate  { lines: string[], lang } → { translations: (string | null)[] }
//
// Failures come back as null so Load Text can degrade gracefully
// (built-in word list only / "Could not fetch translation").

import { NextRequest, NextResponse } from 'next/server'
import { translate, translateMany } from '@/lib/translate'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const word = searchParams.get('word')
  const lang = searchParams.get('lang') ?? 'es'

  if (!word?.trim()) return NextResponse.json({ translation: null })
  return NextResponse.json({ translation: await translate(word, lang) })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { lines?: unknown; lang?: string }
  if (!Array.isArray(body.lines)) return NextResponse.json({ translations: [] })
  return NextResponse.json({ translations: await translateMany(body.lines, body.lang ?? 'es') })
}
