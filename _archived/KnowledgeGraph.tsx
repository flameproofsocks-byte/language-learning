// D3 force-directed graph of the user's encountered vocabulary.
//
// Only words at knowledge level ≥2 appear as nodes. Node size scales with level
// (radius 20/26/32 for Seen/Familiar/Known). Edges come from WORD_RELATIONS /
// MANDARIN_RELATIONS_MAP and are only drawn between nodes that both exist.
//
// An amber dot on a node indicates the user has written a memory tip for that word.
//
// Interaction:
//   - Drag nodes to reposition them (simulation re-heats during drag)
//   - Click a node without dragging to fire onNodeClick (opens note panel in parent)
//   - Hover to highlight connected edges and show a tooltip
//
// This component is imported dynamically with { ssr: false } because D3 uses
// browser-only APIs (SVG measurement, DOM manipulation) that break in Node.

'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as d3 from 'd3'
import { KnowledgeBase, KnowledgeLevel, levelColor, levelLabel } from '@/lib/knowledge'
import { Word } from '@/lib/words'
import { wordsFor } from '@/lib/language-data'
import { WORD_RELATIONS, MANDARIN_RELATIONS_MAP, RELATION_COLOR, RelationType } from '@/lib/relations'
import { Language } from '@/lib/language'

interface Node extends d3.SimulationNodeDatum {
  id: string
  word: Word
  level: KnowledgeLevel
}

interface Link extends d3.SimulationLinkDatum<Node> {
  type: RelationType
}

interface Props {
  kb: KnowledgeBase
  lang?: Language
  onNodeClick?: (wordId: string, word: Word) => void
}

export interface KnowledgeGraphHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  relax: () => void
}

const LEVEL_RADIUS: Record<KnowledgeLevel, number> = { 1: 0, 2: 20, 3: 26, 4: 32 }

const KnowledgeGraph = forwardRef<KnowledgeGraphHandle, Props>(function KnowledgeGraph({ kb, lang = 'es', onNodeClick }, ref) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const simRef  = useRef<d3.Simulation<Node, Link> | null>(null)
  const nodesRef = useRef<Node[]>([])

  useImperativeHandle(ref, () => ({
    zoomIn() {
      if (!svgRef.current || !zoomRef.current) return
      d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1.4)
    },
    zoomOut() {
      if (!svgRef.current || !zoomRef.current) return
      d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1 / 1.4)
    },
    resetZoom() {
      if (!svgRef.current || !zoomRef.current) return
      d3.select(svgRef.current).transition().duration(350).call(zoomRef.current.transform, d3.zoomIdentity)
    },
    relax() {
      if (!simRef.current) return
      // Un-pin all nodes and reheat the simulation so they re-settle naturally.
      nodesRef.current.forEach(n => { n.fx = null; n.fy = null })
      simRef.current.alpha(0.5).restart()
    },
  }))

  useEffect(() => {
    const el = svgRef.current!
    const svg = d3.select(el)
    svg.selectAll('*').remove()

    const { width, height } = el.getBoundingClientRect()
    if (!width || !height) return

    const allWords = wordsFor(lang ?? 'es')
    const relations = lang === 'zh' ? MANDARIN_RELATIONS_MAP : WORD_RELATIONS

    const encounteredIds = new Set(
      Object.entries(kb.words)
        .filter(([, v]) => v.level >= 2)
        .map(([k]) => k)
    )

    const nodes: Node[] = allWords
      .filter(w => encounteredIds.has(w.id))
      .map(w => ({
        id: w.id,
        word: w,
        level: kb.words[w.id].level as KnowledgeLevel,
      }))

    if (nodes.length === 0) {
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#4b5563')
        .attr('font-size', 16)
        .text('No words yet — complete a testing session first')
      return
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]))

    const links: Link[] = relations
      .filter(r => nodeMap.has(r.from) && nodeMap.has(r.to))
      .map(r => ({ source: r.from, target: r.to, type: r.type }))

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<Node, Link>(links)
        .id(d => d.id)
        .distance(d => d.type === 'antonym' ? 120 : d.type === 'category' ? 90 : 140)
        .strength(d => d.type === 'antonym' ? 0.4 : d.type === 'category' ? 0.5 : 0.2)
      )
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<Node>().radius(d => LEVEL_RADIUS[d.level] + 8))

    simRef.current   = sim
    nodesRef.current = nodes

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', e => g.attr('transform', e.transform))

    zoomRef.current = zoom
    svg.call(zoom)

    const g = svg.append('g')

    const linkEl = g.selectAll<SVGLineElement, Link>('line.link')
      .data(links)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', d => RELATION_COLOR[d.type])
      .attr('stroke-width', d => d.type === 'category' || d.type === 'domain' ? 1 : 1.5)
      .attr('stroke-opacity', d => d.type === 'domain' ? 0.45 : 0.65)
      .attr('stroke-dasharray', d =>
        d.type === 'antonym' ? '4 3' :
        d.type === 'domain'  ? '6 3' :
        null
      )

    const notes = kb.notes ?? {}

    const nodeGroup = g.selectAll<SVGGElement, Node>('g.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, Node>()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
            ;(d as Node & { _dragMoved?: boolean })._dragMoved = false
          })
          .on('drag', (event, d) => {
            d.fx = event.x; d.fy = event.y
            ;(d as Node & { _dragMoved?: boolean })._dragMoved = true
          })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0)
            if (!(d as Node & { _dragMoved?: boolean })._dragMoved && onNodeClick) {
              onNodeClick(d.id, d.word)
            }
            d.fx = null; d.fy = null
          })
      )

    nodeGroup.append('circle')
      .attr('r', d => LEVEL_RADIUS[d.level])
      .attr('fill', d => levelColor(d.level) + '20')
      .attr('stroke', d => levelColor(d.level))
      .attr('stroke-width', 1.5)

    // Primary label (pinyin or Spanish word)
    nodeGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.word.characters ? '-0.2em' : '0.35em')
      .attr('fill', '#e5e7eb')
      .attr('font-size', d => d.level === 4 ? 12 : d.level === 3 ? 11 : 10)
      .attr('font-weight', d => d.level === 4 ? '600' : '400')
      .attr('pointer-events', 'none')
      .text(d => d.word.word)

    // Characters below pinyin (Mandarin only)
    nodeGroup.filter(d => !!d.word.characters)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('fill', '#9ca3af')
      .attr('font-size', d => d.level === 4 ? 11 : 10)
      .attr('pointer-events', 'none')
      .text(d => d.word.characters ?? '')

    // Note indicator dot — shown on nodes that have a note
    nodeGroup.filter(d => !!notes[d.id])
      .append('circle')
      .attr('r', 4)
      .attr('cx', d => LEVEL_RADIUS[d.level] - 4)
      .attr('cy', d => -(LEVEL_RADIUS[d.level] - 4))
      .attr('fill', '#f59e0b')
      .attr('stroke', '#030712')
      .attr('stroke-width', 1.5)
      .attr('pointer-events', 'none')

    const tooltip = d3.select('body')
      .selectAll<HTMLDivElement, unknown>('.kg-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'kg-tooltip')
      .style('position', 'fixed')
      .style('background', '#111827')
      .style('border', '1px solid #374151')
      .style('border-radius', '8px')
      .style('padding', '8px 12px')
      .style('font-size', '13px')
      .style('color', '#f9fafb')
      .style('pointer-events', 'none')
      .style('opacity', '0')
      .style('transition', 'opacity 0.1s')
      .style('z-index', '9999')
      .style('line-height', '1.5')

    nodeGroup
      .on('mouseover', (event, d) => {
        linkEl
          .attr('stroke-opacity', l => {
            const src = (l.source as Node).id
            const tgt = (l.target as Node).id
            return src === d.id || tgt === d.id ? 1 : 0.1
          })
          .attr('stroke-width', l => {
            const src = (l.source as Node).id
            const tgt = (l.target as Node).id
            return src === d.id || tgt === d.id ? 2.5 : (l.type === 'related' ? 1 : 1.5)
          })
        tooltip
          .style('opacity', '1')
          .html(`
            <div style="font-weight:700;font-size:17px">${d.word.word}${d.word.characters ? ` <span style="color:#9ca3af;font-weight:400">${d.word.characters}</span>` : ''}</div>
            <div style="color:#9ca3af">${d.word.english}</div>
            <div style="margin-top:4px;font-size:11px;color:${levelColor(d.level)}">${levelLabel(d.level)}</div>
            ${notes[d.id] ? `<div style="margin-top:6px;font-size:12px;color:#fcd34d;border-top:1px solid #374151;padding-top:5px">${notes[d.id].replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>` : ''}
            ${onNodeClick ? `<div style="margin-top:4px;font-size:10px;color:#4b5563">click to ${notes[d.id] ? 'edit' : 'add'} note</div>` : ''}
          `)
      })
      .on('mousemove', event => {
        tooltip
          .style('left', (event.clientX + 14) + 'px')
          .style('top', (event.clientY - 10) + 'px')
      })
      .on('mouseout', () => {
        linkEl
          .attr('stroke-opacity', d => d.type === 'domain' ? 0.45 : 0.65)
          .attr('stroke-width', d => d.type === 'category' || d.type === 'domain' ? 1 : 1.5)
        tooltip.style('opacity', '0')
      })

    sim.on('tick', () => {
      linkEl
        .attr('x1', d => (d.source as Node).x ?? 0)
        .attr('y1', d => (d.source as Node).y ?? 0)
        .attr('x2', d => (d.target as Node).x ?? 0)
        .attr('y2', d => (d.target as Node).y ?? 0)
      nodeGroup.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      sim.stop()
      tooltip.remove()
    }
  }, [kb, lang, onNodeClick])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ display: 'block', background: 'transparent' }}
    />
  )
})

export default KnowledgeGraph
