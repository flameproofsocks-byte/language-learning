// Translate API — used by the Load Text page for words not in the built-in word lists.
//
// GET /api/translate?word=<word>&lang=<lang>
//
// Calls the unofficial Google Translate endpoint (no API key required).
// Returns { translation: string } or { translation: null } on failure.
// If this endpoint becomes unavailable, Load Text falls back to the built-in list only.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const word = searchParams.get('word')
  const lang = searchParams.get('lang') ?? 'es'

  if (!word?.trim()) return NextResponse.json({ translation: null })

  // Translate FROM English TO the requested target language
  const tl = lang === 'zh' ? 'zh-CN' : lang   // map zh → zh-CN for Google
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${tl}&dt=t&q=${encodeURIComponent(word.trim())}`

  try {
    const res  = await fetch(url)
    const data = await res.json()
    // Google's response format: [[[translatedText, originalText, ...]]]
    const t = data?.[0]?.[0]?.[0] as string | undefined
    if (!t?.trim()) return NextResponse.json({ translation: null })
    return NextResponse.json({ translation: t.trim() })
  } catch {
    return NextResponse.json({ translation: null })
  }
}
