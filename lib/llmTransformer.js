/**
 * llmTransformer.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Two modes:
 *
 *  summarisePitch(text)  — investor-focused extraction. Reads any pitch document
 *                          and pulls out the 9 things investors actually care about.
 *                          Returns ≤ 10 slides. Used for all file uploads.
 *
 *  summariseText(text)   — generic summariser for paste-text mode.
 *
 *  transformBlocks(blocks) — rewrites verbose content into mobile-punchy copy.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Investor framework prompt ────────────────────────────────────────────────
// Based on what investors actually filter for — not what founders think matters.

const PITCH_SYSTEM = `
You are a senior venture capital analyst who has reviewed thousands of pitch decks.
Your job is to read any pitch document — deck, memo, one-pager, email — and extract
the exact information investors look for when evaluating a company.

You know that investors make fast decisions based on three core questions:
1. Can this team build something big?
2. Do customers actually want it?
3. Is there evidence they're right?

Everything else is secondary.
`.trim()

const PITCH_USER = (text) => `
Read the document below and extract the key investor signals into a mobile story deck.

INVESTOR PRIORITIES (in order of importance):
1. TEAM          — Domain expertise, execution track record, co-founder fit, relevant experience
2. PROBLEM       — Real pain, urgency, how widespread. Vitamin vs painkiller. Customer insight.
3. SOLUTION      — What's built, how it solves the problem, differentiation vs alternatives
4. MARKET SIZE   — TAM/SAM/SOM. Is it bottoms-up and credible? Venture-scale?
5. TRACTION      — Revenue, ARR, users, growth rate, retention, LOIs, pilots. THE most important signal.
6. BUSINESS MODEL — Revenue model, LTV/CAC ratio, margins, payback period, unit economics
7. WHY NOW       — What changed (technology, regulation, behaviour) that creates this window?
8. COMPETITION   — Honest landscape. What's the moat — network effects, data, switching costs, IP?
9. THE ASK       — Raise amount, use of funds, milestones it achieves, next round path

OUTPUT RULES:
- Return ONLY a valid JSON array. No markdown fences, no commentary.
- Slide 1: Always type "headline" — company name + one-line value proposition (≤ 8 words). Add eyebrow: "Investor Brief".
- Slides 2–9: One slide per section you can extract from the document. Skip any section with zero data.
  • Use type "sub_headline" for team, problem, solution, business model, why now, competition.
    text = section name (e.g. "The Problem"), bullets = 2–3 bullets each ≤ 15 words. Start bullets with a strong verb or number.
  • Use type "proof_point" for market size and traction (number-heavy sections).
    stat = the headline metric, text = what it means (≤ 10 words), source = where it's from.
- Last slide: type "cta". text = the raise amount + key use of funds (≤ 15 words). ctaLabel = "Request deck", ctaUrl = "#contact".
- Max 10 slides total.
- NEVER invent facts, numbers, or names not present in the source.
- If a section cannot be found, skip it entirely.

JSON format:
[
  { "type": "headline",     "content": { "eyebrow": "Investor Brief", "text": "..." } },
  { "type": "sub_headline", "content": { "text": "The Team",     "bullets": ["...", "..."] } },
  { "type": "proof_point",  "content": { "stat": "...", "text": "...", "source": "..." } },
  { "type": "sub_headline", "content": { "text": "The Problem",  "bullets": ["...", "..."] } },
  { "type": "cta",          "content": { "text": "...", "ctaLabel": "Request deck", "ctaUrl": "#contact" } }
]

DOCUMENT:
${text.slice(0, 8000)}
`.trim()

// ─── Generic summariser (paste-text mode) ─────────────────────────────────────

const GENERIC_USER = (text, maxSlides, topic) => `
Convert the following text into a mobile story deck with up to ${maxSlides} slides.
Topic: "${topic || 'General'}"

Rules:
- Slide 1: Powerful headline (type "headline"), ≤ 8 words
- Middle slides: Mix of sub_headline (text + 1–3 bullets ≤ 15 words each) and proof_point (stat + text)
- Final slide: CTA (type "cta") with ctaLabel and ctaUrl "#contact"
- Pull only from the source text — no invention
- Return ONLY a JSON array, no markdown, no commentary

JSON format:
[
  { "type": "headline",     "content": { "text": "..." } },
  { "type": "sub_headline", "content": { "text": "...", "bullets": ["..."] } },
  { "type": "proof_point",  "content": { "stat": "...", "text": "..." } },
  { "type": "cta",          "content": { "text": "...", "ctaLabel": "Learn more", "ctaUrl": "#contact" } }
]

SOURCE:
${text.slice(0, 6000)}
`.trim()

// ─── Transform system prompt (rewrites copy to be punchy) ─────────────────────

const TRANSFORM_SYSTEM = `
You are a mobile-first content editor specialising in story deck copy.
Rewrite verbose content into crisp, punchy mobile-native copy.

Rules:
1. Headline text     → max 8 words. Bold claim. No filler ("Introducing", "We are").
2. Sub-headline text → max 12 words. One clear section label.
3. Bullet points     → max 3 bullets, each ≤ 15 words. Start with strong verb or number.
4. Stat field        → lead with the number/emoji. Max 6 words. (e.g. "3× faster onboarding")
5. CTA label         → action verb + object. Max 4 words.
6. Never invent facts, URLs, or statistics not in the source.
7. Preserve block TYPE — do not change types.
8. Return ONLY a valid JSON array. No commentary, no markdown fences.
`.trim()

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * summarisePitch
 * Investor-focused extraction from any pitch document.
 * Used for all file uploads (PPTX, DOCX, PDF).
 *
 * @param {string} rawText
 * @param {{ deckTopic?: string }} options
 * @returns {Promise<Array<{type, content}>>}
 */
export async function summarisePitch(rawText, { deckTopic = '' } = {}) {
  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system:     PITCH_SYSTEM,
      messages:   [{ role: 'user', content: PITCH_USER(rawText) }],
    })

    let text = message.content[0]?.text ?? '[]'
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    return JSON.parse(text)
  } catch (err) {
    console.error('[llmTransformer] summarisePitch failed:', err.message)
    return []
  }
}

/**
 * summariseText
 * Generic summariser for paste-text mode.
 *
 * @param {string} rawText
 * @param {{ maxSlides?: number, deckTopic?: string }} options
 * @returns {Promise<Array<{type, content}>>}
 */
export async function summariseText(rawText, { maxSlides = 8, deckTopic = '' } = {}) {
  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages:   [{ role: 'user', content: GENERIC_USER(rawText, maxSlides, deckTopic) }],
    })

    let text = message.content[0]?.text ?? '[]'
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    return JSON.parse(text)
  } catch (err) {
    console.error('[llmTransformer] summariseText failed:', err.message)
    return []
  }
}

/**
 * transformBlocks
 * Rewrites existing blocks into mobile-punchy copy.
 * Chunks large decks into groups of 10.
 *
 * @param {StoryBlock[]} blocks
 * @returns {Promise<StoryBlock[]>}
 */
export async function transformBlocks(blocks) {
  if (!blocks?.length) return []

  const CHUNK_SIZE = 10
  const results    = []

  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    const chunk       = blocks.slice(i, i + CHUNK_SIZE)
    const transformed = await transformChunk(chunk)
    results.push(...transformed)
  }

  return results
}

async function transformChunk(blocks) {
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
      system:     TRANSFORM_SYSTEM,
      messages:   [{ role: 'user', content: userMessage }],
    })

    responseText = message.content[0]?.text ?? ''
    responseText = responseText
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim()

    const transformed = JSON.parse(responseText)

    return transformed.map((block, i) => ({
      ...block,
      style_hints: blocks[i]?.style_hints ?? {},
    }))
  } catch (err) {
    console.error('[llmTransformer] transformChunk failed:', err.message)
    return blocks
  }
}

export async function transformSingleBlock(block) {
  const [result] = await transformBlocks([block])
  return result
}
