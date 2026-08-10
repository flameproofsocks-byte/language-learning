// Knowledge persistence API.
//
// GET    /api/knowledge/[lang]  — read progress for a pair key (e.g. "en_id", "id_en")
// POST   /api/knowledge/[lang]  — write the full KnowledgeBase JSON
// DELETE /api/knowledge/[lang]  — reset/delete a knowledge graph
//
// Files are stored in data/knowledge_<key>.json at the project root.
// The client (lib/knowledge.ts) mirrors data to localStorage for instant reads,
// but this server file is the source of truth.

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

function filePath(lang: string) {
  return path.join(DATA_DIR, `knowledge_${lang}.json`)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const fp = filePath(lang)
  if (!fs.existsSync(fp)) {
    // Return an empty base so the client doesn't need to handle 404
    return NextResponse.json({ words: {}, notes: {}, updatedAt: new Date().toISOString() })
  }
  const raw = fs.readFileSync(fp, 'utf-8')
  return NextResponse.json(JSON.parse(raw))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const body = await req.json()
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(filePath(lang), JSON.stringify(body, null, 2))
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const fp = filePath(lang)
  if (fs.existsSync(fp)) fs.unlinkSync(fp)
  return NextResponse.json({ ok: true })
}
