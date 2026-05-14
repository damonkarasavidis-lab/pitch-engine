/**
 * contentParser.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Converts raw Markdown or structured JSON into an ordered array of StoryBlocks.
 *
 * Supported input formats
 *  1. JSON — already a StoryBlock array (validated & normalised)
 *  2. Markdown — heuristic parsing based on heading levels + content patterns
 *
 * Output: StoryBlock[]  (see type definition in ARCHITECTURE.md)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { randomUUID } from 'crypto'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * parseContent
 * @param {string} raw   - Raw string (Markdown) or JSON string
 * @param {'markdown'|'json'} format
 * @returns {StoryBlock[]}
 */
export function parseContent(raw, format = 'markdown') {
  if (!raw || typeof raw !== 'string') throw new Error('parseContent: raw must be a non-empty string')

  const trimmed = raw.trim()

  if (format === 'json' || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return parseJSON(trimmed)
  }

  return parseMarkdown(trimmed)
}

// ─── JSON parser ──────────────────────────────────────────────────────────────

function parseJSON(raw) {
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('parseContent: invalid JSON input')
  }

  const blocks = Array.isArray(data) ? data : [data]
  return blocks.map(normaliseBlock)
}

function normaliseBlock(block, index) {
  const VALID_TYPES = new Set(['headline', 'sub_headline', 'visual', 'proof_point', 'cta'])

  return {
    id:          block.id          ?? randomUUID(),
    type:        VALID_TYPES.has(block.type) ? block.type : 'sub_headline',
    order_index: block.order_index ?? index,
    content:     block.content     ?? {},
    style_hints: block.style_hints ?? defaultStyleHints(block.type, index),
  }
}

// ─── Markdown parser ──────────────────────────────────────────────────────────
//
// Heuristic rules:
//  # Heading 1   → headline block
//  ## Heading 2  → sub_headline block
//  > Blockquote  → proof_point block (stat = first word cluster, source = attribution)
//  - bullet list  → appended as bullets[] to the previous sub_headline
//  ![img](url)   → visual block
//  [CTA text](url) on its own line → cta block
//  Any other paragraph → sub_headline block
//
// The parser is intentionally simple — for production, layer in a full MD AST
// library like `remark` + custom plugins.

function parseMarkdown(raw) {
  const lines  = raw.split('\n')
  const blocks = []
  let   pending = null   // block being assembled (for bullet aggregation)

  const flush = () => {
    if (pending) {
      blocks.push(finalise(pending, blocks.length))
      pending = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      // Blank line: flush pending block
      flush()
      continue
    }

    // ── H1: headline ─────────────────────────────────────────────────────────
    if (/^# /.test(trimmed)) {
      flush()
      pending = {
        type: 'headline',
        content: { text: trimmed.replace(/^# /, '') },
        style_hints: defaultStyleHints('headline', blocks.length),
      }
      flush()
      continue
    }

    // ── H2: sub_headline ──────────────────────────────────────────────────────
    if (/^## /.test(trimmed)) {
      flush()
      pending = {
        type: 'sub_headline',
        content: { text: trimmed.replace(/^## /, ''), bullets: [] },
        style_hints: defaultStyleHints('sub_headline', blocks.length),
      }
      continue
    }

    // ── H3: eyebrow label on next headline ────────────────────────────────────
    if (/^### /.test(trimmed)) {
      flush()
      pending = {
        type: 'headline',
        content: { eyebrow: trimmed.replace(/^### /, ''), text: '' },
        style_hints: defaultStyleHints('headline', blocks.length),
      }
      // peek next non-blank line for headline text
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim()
        if (!next) continue
        if (/^# /.test(next)) {
          pending.content.text = next.replace(/^# /, '')
          i = j
        }
        break
      }
      flush()
      continue
    }

    // ── Blockquote: proof_point ───────────────────────────────────────────────
    if (/^> /.test(trimmed)) {
      flush()
      const quote = trimmed.replace(/^> /, '')
      // Pattern: "10× faster — Acme Corp" → stat + source
      const dashMatch = quote.match(/^(.+?)\s+[—–-]\s+(.+)$/)
      pending = {
        type: 'proof_point',
        content: dashMatch
          ? { stat: dashMatch[1].trim(), source: dashMatch[2].trim() }
          : { text: quote },
        style_hints: defaultStyleHints('proof_point', blocks.length),
      }
      flush()
      continue
    }

    // ── Image: visual ─────────────────────────────────────────────────────────
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) {
      flush()
      pending = {
        type: 'visual',
        content: { mediaUrl: imgMatch[2], mediaAlt: imgMatch[1] },
        style_hints: defaultStyleHints('visual', blocks.length),
      }
      flush()
      continue
    }

    // ── Standalone link: CTA ──────────────────────────────────────────────────
    const ctaMatch = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (ctaMatch) {
      flush()
      pending = {
        type: 'cta',
        content: { ctaLabel: ctaMatch[1], ctaUrl: ctaMatch[2] },
        style_hints: defaultStyleHints('cta', blocks.length),
      }
      flush()
      continue
    }

    // ── Bullet list item ──────────────────────────────────────────────────────
    if (/^[-*•] /.test(trimmed)) {
      const bullet = trimmed.replace(/^[-*•] /, '')
      if (pending?.type === 'sub_headline') {
        pending.content.bullets = pending.content.bullets || []
        pending.content.bullets.push(bullet)
      } else {
        // No parent block: start a new sub_headline
        if (!pending) {
          pending = {
            type: 'sub_headline',
            content: { text: '', bullets: [] },
            style_hints: defaultStyleHints('sub_headline', blocks.length),
          }
        }
        pending.content.bullets = pending.content.bullets || []
        pending.content.bullets.push(bullet)
      }
      continue
    }

    // ── Plain paragraph → sub_headline ────────────────────────────────────────
    if (!pending) {
      pending = {
        type: 'sub_headline',
        content: { text: trimmed, bullets: [] },
        style_hints: defaultStyleHints('sub_headline', blocks.length),
      }
    } else if (pending.type === 'sub_headline') {
      // Append to existing paragraph text
      pending.content.text += pending.content.text ? ' ' + trimmed : trimmed
    } else {
      flush()
      pending = {
        type: 'sub_headline',
        content: { text: trimmed, bullets: [] },
        style_hints: defaultStyleHints('sub_headline', blocks.length),
      }
    }
  }

  flush()
  return blocks
}

function finalise(partial, orderIndex) {
  return {
    id:          randomUUID(),
    type:        partial.type,
    order_index: orderIndex,
    content:     partial.content,
    style_hints: partial.style_hints ?? defaultStyleHints(partial.type, orderIndex),
  }
}

// ─── Style hint palette (cycles through a set of presets) ────────────────────

// Accent colours cycle per slide — backgrounds are handled by StoryBlock itself (light theme).
const PALETTES = [
  { accentColor: '#6366f1' },  // indigo  — headline
  { accentColor: '#0ea5e9' },  // sky     — team
  { accentColor: '#f59e0b' },  // amber   — problem
  { accentColor: '#10b981' },  // emerald — solution
  { accentColor: '#8b5cf6' },  // violet  — market
  { accentColor: '#ef4444' },  // red     — traction (urgency)
  { accentColor: '#06b6d4' },  // cyan    — business model
  { accentColor: '#f97316' },  // orange  — why now
  { accentColor: '#64748b' },  // slate   — competition
  { accentColor: '#6366f1' },  // indigo  — ask (matches headline)
]

const LAYOUT_MAP = {
  headline:    'centered',
  sub_headline:'centered',
  visual:      'bottom',
  proof_point: 'centered',
  cta:         'centered',
}

function defaultStyleHints(type, index) {
  const palette = PALETTES[index % PALETTES.length]
  return {
    ...palette,
    layout: LAYOUT_MAP[type] || 'centered',
  }
}
