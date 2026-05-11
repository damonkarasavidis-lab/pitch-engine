/**
 * app/d/[slug]/page.jsx  — Deck Viewer (Server Component)
 * ──────────────────────────────────────────────────────────────────────────────
 * Responsibilities:
 *  1. Fetch deck + story_blocks from Supabase on the server
 *  2. Return a 404 for unknown slugs
 *  3. Generate full OG / Twitter metadata for link unfurling
 *     (WhatsApp, Slack, iMessage all read these tags)
 *  4. Pass the blocks down to DeckClient (the interactive client component)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { notFound }  from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import DeckClient    from './DeckClient'

// ── Supabase (server-side, anon key is fine for public reads) ──────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars. Make sure NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local and the dev server was restarted.'
    )
  }

  return createClient(url, key)
}

// ── Data fetcher ──────────────────────────────────────────────────────────
async function getDeck(slug) {
  const supabase = getSupabase()

  // Fetch deck row
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('id, slug, title, meta_description, slide_count, created_at')
    .eq('slug', slug)
    .single()

  if (deckError || !deck) return null

  // Fetch story blocks, ordered
  const { data: blocks, error: blocksError } = await supabase
    .from('story_blocks')
    .select('id, type, order_index, content, style_hints')
    .eq('deck_id', deck.id)
    .order('order_index', { ascending: true })

  if (blocksError || !blocks?.length) return null

  return { deck, blocks }
}

// ── OG Metadata ───────────────────────────────────────────────────────────
// Next.js calls this at request time (or build time if page is static).
// The generated tags are what WhatsApp/Slack/iMessage read when someone
// pastes the link.

export async function generateMetadata({ params }) {
  const result = await getDeck(params.slug)

  if (!result) {
    return { title: 'Deck not found' }
  }

  const { deck } = result
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const pageUrl  = `${appUrl}/d/${deck.slug}`
  const ogImage  = `${appUrl}/api/og?slug=${deck.slug}`   // Step 7

  return {
    title:       deck.title,
    description: deck.meta_description,

    openGraph: {
      title:       deck.title,
      description: deck.meta_description,
      url:         pageUrl,
      type:        'website',
      images: [{
        url:    ogImage,
        width:  1200,
        height: 630,
        alt:    deck.title,
      }],
    },

    twitter: {
      card:        'summary_large_image',
      title:       deck.title,
      description: deck.meta_description,
      images:      [ogImage],
    },

    // iMessage / iOS web clip
    appleWebApp: {
      capable:         true,
      statusBarStyle:  'black-translucent',
      title:           deck.title,
    },

    // Canonical URL
    alternates: {
      canonical: pageUrl,
    },
  }
}

// ── Page Component ────────────────────────────────────────────────────────
export default async function DeckPage({ params }) {
  const result = await getDeck(params.slug)

  // Unknown slug → Next.js 404 page
  if (!result) notFound()

  const { deck, blocks } = result

  return (
    <DeckClient
      deckId={deck.id}
      blocks={blocks}
      title={deck.title}
    />
  )
}
