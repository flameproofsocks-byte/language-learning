// Vocab Graph persistence API.
//
// GET  /api/vocab-graph  — load the user-built vocabulary graph
// POST /api/vocab-graph  — save the full graph (nodes + edges)
//
// Stored at data/vocab_graph.json.
// This is separate from knowledge_*.json — it's a freeform canvas the user
// builds manually rather than one derived from session results.

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR  = path.join(process.cwd(), 'data')
const FILE_PATH = path.join(DATA_DIR, 'vocab_graph.json')

const EMPTY = { nodes: [], edges: [] }

export async function GET() {
  if (!fs.existsSync(FILE_PATH)) return NextResponse.json(EMPTY)
  try {
    return NextResponse.json(JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8')))
  } catch {
    return NextResponse.json(EMPTY)
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(FILE_PATH, JSON.stringify(body, null, 2))
  return NextResponse.json({ ok: true })
}
