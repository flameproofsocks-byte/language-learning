// GET /api/knowledge — list all saved knowledge graphs with word-count stats.
// Returns an array of { key, wordCounts } for each data/knowledge_*.json file found.

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

export async function GET() {
  if (!fs.existsSync(DATA_DIR)) {
    return NextResponse.json([])
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('knowledge_') && f.endsWith('.json'))

  const graphs = files.map(file => {
    const key = file.replace('knowledge_', '').replace('.json', '')
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
      const kb = JSON.parse(raw)
      const words: Record<string, { level: number }> = kb.words ?? {}
      const wordCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }
      for (const w of Object.values(words)) {
        const lvl = w.level as 1 | 2 | 3 | 4
        if (lvl in wordCounts) wordCounts[lvl]++
      }
      const noteCount = Object.keys(kb.notes ?? {}).length
      return { key, wordCounts, noteCount, updatedAt: kb.updatedAt ?? null }
    } catch {
      return { key, wordCounts: { 1: 0, 2: 0, 3: 0, 4: 0 }, noteCount: 0, updatedAt: null }
    }
  })

  return NextResponse.json(graphs)
}
