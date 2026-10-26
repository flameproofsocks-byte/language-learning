// Google Translate (unofficial, keyless) — translates FROM `lang` TO English.
// Shared by /api/translate and the playlist export. Returns null on failure.

const CONCURRENCY = 5

export async function translate(text: string, lang: string): Promise<string | null> {
  const sl = lang === 'zh' ? 'zh-CN' : lang   // map zh → zh-CN for Google
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=en&dt=t&q=${encodeURIComponent(text.trim())}`
  // The unofficial endpoint occasionally fails transiently, so retry once.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res  = await fetch(url)
      const data = await res.json()
      // Google's response format: [[[translatedText, originalText, ...], ...]] — long input
      // is split into several chunks, so join them all.
      const t = (data?.[0] as [string][] | undefined)?.map(chunk => chunk[0]).join('')
      if (t?.trim()) return t.trim()
    } catch { /* fall through to retry */ }
  }
  return null
}

export async function translateMany(lines: string[], lang: string): Promise<(string | null)[]> {
  const out: (string | null)[] = new Array(lines.length).fill(null)
  let next = 0
  async function worker() {
    while (next < lines.length) {
      const i = next++
      if (lines[i]?.trim()) out[i] = await translate(lines[i], lang)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, lines.length) }, worker))
  return out
}
