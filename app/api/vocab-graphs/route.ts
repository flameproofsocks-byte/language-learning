// GET  /api/vocab-graphs        — list all graph metadata
// POST /api/vocab-graphs        — create a new graph (body: { name, nodes?, edges? })

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DIR = path.join(process.cwd(), 'data', 'vocab_graphs')

async function ensureDir() {
  await fs.mkdir(DIR, { recursive: true })
}

export async function GET() {
  await ensureDir()

  // ── Migrate legacy single-graph file on first run
  const legacyPath = path.join(process.cwd(), 'data', 'vocab_graph.json')
  const files = await fs.readdir(DIR).catch(() => [] as string[])
  if (files.filter(f => f.endsWith('.json')).length === 0) {
    try {
      const raw  = await fs.readFile(legacyPath, 'utf-8')
      const data = JSON.parse(raw)
      if (data.nodes?.length) {
        const id  = `graph_${Date.now()}`
        const now = new Date().toISOString()
        await fs.writeFile(
          path.join(DIR, `${id}.json`),
          JSON.stringify({ id, name: 'My Graph', createdAt: now, updatedAt: now, ...data }, null, 2),
        )
      }
    } catch {}
  }

  const allFiles = await fs.readdir(DIR).catch(() => [] as string[])
  const graphs: object[] = []
  for (const file of allFiles) {
    if (!file.endsWith('.json')) continue
    try {
      const raw  = await fs.readFile(path.join(DIR, file), 'utf-8')
      const data = JSON.parse(raw)
      graphs.push({
        id:        data.id,
        name:      data.name ?? 'Untitled',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        nodeCount: (data.nodes ?? []).length,
      })
    } catch {}
  }

  graphs.sort((a: any, b: any) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  return NextResponse.json(graphs)
}

export async function POST(req: NextRequest) {
  await ensureDir()
  const body = await req.json().catch(() => ({}))
  const id   = `graph_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const now  = new Date().toISOString()
  const graph = {
    id,
    name:      body.name      ?? 'Untitled Graph',
    createdAt: body.createdAt ?? now,
    updatedAt: now,
    nodes:     body.nodes     ?? [],
    edges:     body.edges     ?? [],
  }
  await fs.writeFile(path.join(DIR, `${id}.json`), JSON.stringify(graph, null, 2))
  return NextResponse.json(graph)
}
