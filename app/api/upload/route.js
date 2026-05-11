/**
 * app/api/upload/route.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Accepts a multipart file upload, extracts text, and runs the full ingest
 * pipeline — returning the same { deckId, slug, shareUrl } as /api/ingest.
 *
 * POST /api/upload
 * Body: FormData with fields:
 *   file   — the uploaded file (.pptx, .docx, .pdf)
 *   title  — optional override for the deck title
 *
 * Max file size: 20MB (configured in Next.js below)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createClient }    from '@supabase/supabase-js'
import { NextResponse }    from 'next/server'
import { extractFile }     from '@/lib/fileExtractor'
import { summariseText }   from '@/lib/llmTransformer'
import { parseContent }    from '@/lib/contentParser'
import { generateSlug }    from '@/lib/slugify'

// Increase Next.js body size limit for file uploads
export const config = {
  api: { bodyParser: false },
}

// 20MB limit
export const maxDuration = 60  // Vercel: allow up to 60s for large files + LLM

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  // ── 1. Parse multipart form data ─────────────────────────────────────────
  let formData
  try {
    formData = await request.formData()
  } catch {
    return error(400, 'Could not parse form data. Make sure you are sending multipart/form-data.')
  }

  const file  = formData.get('file')
  const title = formData.get('title') || ''

  if (!file || typeof file === 'string') {
    return error(400, 'No file provided. Send a .pptx, .docx, or .pdf file in the "file" field.')
  }

  // ── 2. Validate file size (20MB max) ─────────────────────────────────────
  const MAX_BYTES = 20 * 1024 * 1024
  if (file.size > MAX_BYTES) {
    return error(413, `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 20MB.`)
  }

  // ── 3. Extract text from the file ────────────────────────────────────────
  let extracted
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)
    extracted = await extractFile(buffer, file.name, file.type)
  } catch (err) {
    return error(422, 'Could not extract content from this file.', err.message)
  }

  if (!extracted.text || extracted.text.trim().length < 20) {
    return error(422, 'The file appears to be empty or contains no readable text.')
  }

  // ── 4. Use file title if none provided ───────────────────────────────────
  const deckTitle = (title.trim() || extracted.title || 'Untitled Deck').slice(0, 80)

  // ── 5. Summarise into story blocks via LLM ───────────────────────────────
  let rawSlides
  try {
    rawSlides = await summariseText(extracted.text, {
      maxSlides: Math.min(Math.max(extracted.slideCount, 5), 12),
      deckTopic: deckTitle,
    })
  } catch (err) {
    console.warn('[upload] LLM summarise failed, falling back to raw parse:', err.message)
    rawSlides = null
  }

  // ── 6. Parse into StoryBlock format ──────────────────────────────────────
  let blocks
  if (rawSlides?.length) {
    const asJson = JSON.stringify(
      rawSlides.map((s, i) => ({
        ...s,
        id:          crypto.randomUUID(),
        order_index: i,
      }))
    )
    blocks = parseContent(asJson, 'json')
  } else {
    // LLM fallback: parse the raw extracted text as markdown
    blocks = parseContent(extracted.text.slice(0, 8000), 'markdown')
  }

  if (!blocks.length) {
    return error(422, 'Could not structure the file content into slides.')
  }

  // ── 7. Generate slug + meta ───────────────────────────────────────────────
  const slug           = generateSlug(deckTitle)
  const firstBodyBlock = blocks.find((b) => ['sub_headline', 'proof_point'].includes(b.type))
  const metaDescription = (
    firstBodyBlock?.content?.text ||
    firstBodyBlock?.content?.bullets?.[0] ||
    deckTitle
  ).slice(0, 160)

  // ── 8. Persist to Supabase ────────────────────────────────────────────────
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .insert({
      slug,
      title:            deckTitle,
      meta_description: metaDescription,
      slide_count:      blocks.length,
    })
    .select('id, slug')
    .single()

  if (deckError) {
    return error(500, 'Failed to create deck', deckError.message)
  }

  const blockRows = blocks.map((b) => ({
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
    await supabase.from('decks').delete().eq('id', deck.id)
    return error(500, 'Failed to save story blocks', blocksError.message)
  }

  // ── 9. Return share URL ───────────────────────────────────────────────────
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const shareUrl = `${appUrl}/d/${deck.slug}`

  return NextResponse.json(
    {
      deckId:     deck.id,
      slug:       deck.slug,
      shareUrl,
      slideCount: blocks.length,
      sourceFile: file.name,
    },
    { status: 201 }
  )
}

function error(status, message, details) {
  const body = { error: message }
  if (details) body.details = details
  return NextResponse.json(body, { status })
}
