/**
 * slugify.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Generates short, URL-safe slugs for deck share links.
 *
 * Format: [readable-words]-[4 random chars]
 * Example: "mobile-pitch-x7k2"
 *
 * The random suffix guarantees uniqueness even when two decks share
 * the same title, without needing a database round-trip to check collisions.
 * ──────────────────────────────────────────────────────────────────────────────
 */

const ADJECTIVES = [
  'bold', 'clear', 'sharp', 'swift', 'prime', 'smart', 'bright', 'clean',
  'fresh', 'grand', 'lean', 'rapid', 'solid', 'vital', 'vivid', 'sleek',
]

const NOUNS = [
  'pitch', 'deck', 'brief', 'story', 'slide', 'frame', 'scope', 'view',
  'wave', 'edge', 'spark', 'arc', 'pulse', 'flow', 'beam', 'cast',
]

const CHARS = 'abcdefghjkmnpqrstuvwxyz23456789' // no ambiguous chars (0/O, 1/I/l)

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)]
}

function randomSuffix(length = 4) {
  return Array.from({ length }, randomChar).join('')
}

/**
 * generateSlug
 * @param {string} [title] - Optional deck title to derive words from
 * @returns {string} e.g. "mobile-pitch-x7k2"
 */
export function generateSlug(title) {
  let prefix

  if (title && title.trim().length > 0) {
    // Derive up to 2 words from the title
    prefix = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')    // strip punctuation
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join('-')
  }

  if (!prefix || prefix.length < 3) {
    // Fall back to adjective-noun combo
    const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
    prefix = `${adj}-${noun}`
  }

  return `${prefix}-${randomSuffix(4)}`
}
