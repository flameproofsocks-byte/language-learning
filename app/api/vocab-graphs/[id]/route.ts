// GET    /api/vocab-graphs/[id]  — load a graph
// POST   /api/vocab-graphs/[id]  — save / overwrite a graph
// PATCH  /api/vocab-graphs/[id]  — rename (body: { name })
// DELETE /api/vocab-graphs/[id]  — delete

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DIR = path.join(process.cwd(), 'data', 'vocab_graphs')

function fp(id: string) {
  // Sanitise: only allow alphanumeric, underscores, hyphens
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(DIR, `${safe}.json`)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const raw = await fs.readFile(fp(id), 'utf-8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await fs.mkdir(DIR, { recursive: true })
  const body = await req.json()
  const now  = new Date().toISOString()

  let createdAt = now, name = body.name ?? 'Untitled Graph'
  try {
    const existing = JSON.parse(await fs.readFile(fp(id), 'utf-8'))
    createdAt = existing.createdAt ?? now
    name      = body.name ?? existing.name ?? name
  } catch {}

  const graph = { ...body, id, name, createdAt, updatedAt: now }
  await fs.writeFile(fp(id), JSON.stringify(graph, null, 2))
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json()
  try {
    const raw  = await fs.readFile(fp(id), 'utf-8')
    const data = JSON.parse(raw)
    if (body.name !== undefined) data.name = body.name
    data.updatedAt = new Date().toISOString()
    await fs.writeFile(fp(id), JSON.stringify(data, null, 2))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try { await fs.unlink(fp(id)) } catch {}
  return NextResponse.json({ ok: true })
}
