/**
 * app/api/ingest/route.js  (Next.js App Router)
 * ──────────────────────────────────────────────────────────────────────────────
 * Accepts raw content, transforms it into a story deck, and persists it to
 * Supabase. Returns a shareable URL the client can redirect to.
 *
 * POST /api/ingest
 * Body (JSON):
 *  {
 *    content : string   — raw Markdown, plain text, or JSON StoryBlock array
 *    format  : 'markdown' | 'json' | 'text'   (default: 'markdown')
 *    title   : string   — optional deck title (used in OG tags + slug)
 *    transform: boolean — run LLM transformer? (default: true)
 *  }
 *
 * Response (JSON):
 *  {
 *    deckId  : string   — Supabase UUID
 *    slug    : string   — human-readable short ID
 *    shareUrl: string   — full URL to the deck viewer
 *  }
 *
 * Error responses always include { error: string, details?: string }
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createClient }     from '@supabase/supabase-js'
import { NextResponse }     from 'next/server'
import { parseContent }     from '@/lib/contentParser'
import { transformBlocks, summariseText } from '@/lib/llmTransformer'
import { generateSlug }     from '@/lib/slugify'

// ── Supabase client (service role — server only) ───────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── POST handler ──────────────────────────────────────────────────────────
export async function POST(request) {
  // ── 1. Parse and validate the request body ───────────────────────────────
  let body
  try {
    body = await request.json()
  } catch {
    return error(400, 'Request body must be valid JSON')
  }

  const {
    content,
    format    = 'markdown',
    title     = '',
    transform = true,
  } = body

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return error(400, 'content is required and must be a non-empty string')
  }

  if (!['markdown', 'json', 'text'].includes(format)) {
    return error(400, "format must be 'markdown', 'json', or 'text'")
  }

  // ── 2. Parse content into StoryBlocks ────────────────────────────────────
  let blocks
  try {
    if (format === 'text') {
      // Plain text: ask the LLM to structure it into slides from scratch
      const rawSlides = await summariseText(content, {
        maxSlides: 8,
        deckTopic: title,
      })

      // Attach IDs and style hints via the JSON parser
      const asJson = JSON.stringify(rawSlides.map((s, i) => ({
        ...s,
        id:          crypto.randomUUID(),
        order_index: i,
      })))

      blocks = parseContent(asJson, 'json')
    } else {
      blocks = parseContent(content, format)
    }
  } catch (err) {
    return error(422, 'Failed to parse content', err.message)
  }

  if (!blocks.length) {
    return error(422, 'No story blocks could be extracted from the provided content')
  }

  // ── 3. LLM Transform (make copy punchy) ──────────────────────────────────
  // Skipped when format=text because summariseText already produces punchy copy,
  // or when the caller explicitly opts out.
  let finalBlocks = blocks
  if (transform && format !== 'text') {
    try {
      finalBlocks = await transformBlocks(blocks)
    } catch (err) {
      // Non-fatal: fall back to unpunchy originals
      console.warn('[ingest] LLM transform failed, using raw blocks:', err.message)
      finalBlocks = blocks
    }
  }

  // ── 4. Generate slug and derive a title ───────────────────────────────────
  const slug       = generateSlug(title)
  const deckTitle  = title.trim() ||
    finalBlocks[0]?.content?.text?.slice(0, 60) ||
    'Untitled Deck'

  // Derive a meta description from the first sub_headline or proof_point
  const firstBody = finalBlocks.find(
    (b) => ['sub_headline', 'proof_point'].includes(b.type)
  )
  const metaDescription =
    firstBody?.content?.text?.slice(0, 160) ||
    firstBody?.content?.bullets?.[0]?.slice(0, 160) ||
    deckTitle

  // ── 5. Persist deck to Supabase ───────────────────────────────────────────
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .insert({
      slug,
      title:            deckTitle,
      meta_description: metaDescription,
      slide_count:      finalBlocks.length,
    })
    .select('id, slug')
    .single()

  if (deckError) {
    return error(500, 'Failed to create deck', deckError.message)
  }

  // ── 6. Persist story blocks ───────────────────────────────────────────────
  const blockRows = finalBlocks.map((b) => ({
    deck_id:     deck.id,
    type:        b.type,
    order_index: b.order_index,
    content:     b.content,
    style_hints: b.style_hints,
  }))

  const { error: blocksError } = await supabase
    .from('story_blocks')
    .insert(blockRows)

  if (blocksError) {
    // Roll back the deck row so we don't leave orphaned decks
    await supabase.from('decks').delete().eq('id', deck.id)
    return error(500, 'Failed to save story blocks', blocksError.message)
  }

  // ── 7. Return the share URL ───────────────────────────────────────────────
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const shareUrl = `${appUrl}/d/${deck.slug}`

  return NextResponse.json(
    { deckId: deck.id, slug: deck.slug, shareUrl },
    { status: 201 }
  )
}

// ── Helper ────────────────────────────────────────────────────────────────
function error(status, message, details) {
  const body = { error: message }
  if (details) body.details = details
  return NextResponse.json(body, { status })
}
