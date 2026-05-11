/**
 * llmTransformer.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Transforms verbose StoryBlock content into "Mobile-Punchy" copy using the
 * Anthropic API (claude-haiku-4-5 for speed + cost efficiency).
 *
 * Rules enforced by the prompt:
 *  • Headline  : ≤ 8 words, punchy, no fluff
 *  • Bullets   : ≤ 15 words per bullet, max 3 bullets per block
 *  • Stat      : numeric/emoji lead, ≤ 6 words
 *  • CTA label : action verb + noun, ≤ 4 words
 *
 * Usage (server-side only — never expose ANTHROPIC_API_KEY to the client):
 *
 *   import { transformBlocks } from '@/lib/llmTransformer'
 *   const punchyBlocks = await transformBlocks(rawBlocks)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a mobile-first content editor specialising in "story deck" copy — the
kind that appears in Instagram Stories, Snapchat Spotlight, and high-end mobile
editorials. Your job is to rewrite verbose content into crisp, punchy copy.

Rules (non-negotiable):
1. Headline text     → max 8 words. Bold claim. No filler ("Introducing", "We are", "Our").
2. Sub-headline text → max 15 words. One clear idea per line.
3. Bullet points     → max 3 bullets, each ≤ 15 words. Start with a strong verb or number.
4. Stat field        → lead with the number/emoji. Max 6 words total. (e.g. "10× faster delivery")
5. CTA label         → action verb + object. Max 4 words. (e.g. "Book your demo")
6. Never invent facts, URLs, or statistics not present in the source.
7. Preserve the block's TYPE — do not change "headline" to "sub_headline", etc.
8. Return ONLY a valid JSON array of StoryBlock objects. No commentary, no markdown fences.
`.trim()

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * transformBlocks
 * Sends all blocks in a single LLM call (batched for efficiency).
 * For very long decks (>20 blocks), chunks into groups of 10.
 *
 * @param {StoryBlock[]} blocks
 * @returns {Promise<StoryBlock[]>}
 */
export async function transformBlocks(blocks) {
  if (!blocks?.length) return []

  const CHUNK_SIZE = 10
  const results    = []

  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    const chunk = blocks.slice(i, i + CHUNK_SIZE)
    const transformed = await transformChunk(chunk)
    results.push(...transformed)
  }

  return results
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function transformChunk(blocks) {
  // Strip style_hints from the payload to reduce token count
  const payload = blocks.map(({ id, type, order_index, content }) => ({
    id, type, order_index, content,
  }))

  const userMessage = `
Transform the following StoryBlock array into mobile-punchy copy.
Return ONLY the JSON array — no markdown, no explanation.

INPUT:
${JSON.stringify(payload, null, 2)}
`.trim()

  let responseText = ''

  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    })

    responseText = message.content[0]?.text ?? ''

    // Strip accidental markdown fences
    responseText = responseText
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim()

    const transformed = JSON.parse(responseText)

    // Merge back the style_hints from originals (LLM doesn't touch these)
    return transformed.map((block, i) => ({
      ...block,
      style_hints: blocks[i]?.style_hints ?? {},
    }))
  } catch (err) {
    console.error('[llmTransformer] Failed to transform chunk:', err.message)
    console.error('[llmTransformer] Raw response:', responseText)

    // Graceful degradation: return originals untransformed
    return blocks
  }
}

// ─── Single-block convenience wrapper ─────────────────────────────────────────

/**
 * transformSingleBlock
 * Useful for real-time preview as user types.
 *
 * @param {StoryBlock} block
 * @returns {Promise<StoryBlock>}
 */
export async function transformSingleBlock(block) {
  const [result] = await transformBlocks([block])
  return result
}

// ─── Text-only summariser (for ingesting raw long-form text) ──────────────────

/**
 * summariseText
 * Takes raw long-form text and returns an array of StoryBlock-ready
 * content objects (no IDs or style_hints — those are added by contentParser).
 *
 * @param {string} rawText
 * @param {object} options
 * @param {number} options.maxSlides   - Target number of slides (default: 8)
 * @param {string} options.deckTopic  - Hint for the LLM about the deck's topic
 * @returns {Promise<Array<{type, content}>>}
 */
export async function summariseText(rawText, { maxSlides = 8, deckTopic = '' } = {}) {
  const prompt = `
You are converting long-form text into a mobile story deck with ${maxSlides} slides.
Topic hint: "${deckTopic || 'General'}"

Rules:
- Slide 1: Powerful headline (type: "headline"), ≤ 8 words
- Slides 2–${maxSlides - 1}: Mix of sub_headline (with 1-3 bullets, ≤15 words each) and proof_point blocks
- Final slide: A clear CTA (type: "cta") with ctaLabel and ctaUrl set to "#contact"
- Every piece of content must come from the source text — no invention

Return ONLY a JSON array like:
[
  { "type": "headline",    "content": { "text": "..." } },
  { "type": "sub_headline","content": { "text": "...", "bullets": ["...", "..."] } },
  { "type": "proof_point", "content": { "stat": "...", "source": "..." } },
  { "type": "cta",         "content": { "text": "...", "ctaLabel": "...", "ctaUrl": "#contact" } }
]

SOURCE TEXT:
${rawText.slice(0, 6000)}
`.trim()

  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages:   [{ role: 'user', content: prompt }],
    })

    let text = message.content[0]?.text ?? '[]'
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    return JSON.parse(text)
  } catch (err) {
    console.error('[llmTransformer] summariseText failed:', err.message)
    return []
  }
}
