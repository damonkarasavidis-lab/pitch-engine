/**
 * app/api/og/route.jsx — OG Image Generation
 * ──────────────────────────────────────────────────────────────────────────────
 * Generates a 1200×630 branded preview card for a deck.
 * Called automatically by Next.js when generateMetadata() sets og:image
 * to `/api/og?slug=...`
 *
 * WhatsApp, Slack, iMessage, Twitter, LinkedIn all fetch this URL when
 * someone pastes a deck share link.
 *
 * Uses @vercel/og (Satori under the hood) — renders JSX to a PNG via
 * a lightweight Wasm font renderer. No canvas, no Puppeteer, no cold starts.
 *
 * Edge Runtime is required for @vercel/og — it cannot run in Node.js runtime.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { ImageResponse } from '@vercel/og'
import { createClient }  from '@supabase/supabase-js'

export const runtime = 'edge'

// ── Dimensions ─────────────────────────────────────────────────────────────
const WIDTH  = 1200
const HEIGHT = 630

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  // Fallback card when no slug is provided
  if (!slug) {
    return fallbackCard()
  }

  // Fetch deck metadata from Supabase
  let deck = null
  let firstBlock = null

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { data: deckData } = await supabase
      .from('decks')
      .select('id, title, meta_description, slide_count')
      .eq('slug', slug)
      .single()

    deck = deckData

    if (deck) {
      const { data: blocks } = await supabase
        .from('story_blocks')
        .select('type, content, style_hints')
        .eq('deck_id', deck.id)
        .order('order_index', { ascending: true })
        .limit(1)

      firstBlock = blocks?.[0] ?? null
    }
  } catch {
    // Silently fall back — OG image should never hard-error
  }

  if (!deck) return fallbackCard()

  // Extract headline text for the card
  const headline = firstBlock?.content?.text
    ?? deck.title
    ?? 'Story Deck'

  // Truncate for display
  const displayTitle    = truncate(deck.title, 55)
  const displayHeadline = truncate(headline, 72)
  const slideLabel      = `${deck.slide_count ?? '?'} slides`

  // Accent colour from the first block's style_hints, default indigo
  const accent = firstBlock?.style_hints?.accentColor ?? '#6366f1'

  return new ImageResponse(
    (
      <div
        style={{
          width:          WIDTH,
          height:         HEIGHT,
          display:        'flex',
          flexDirection:  'column',
          background:     '#0f0f0f',
          fontFamily:     'system-ui, -apple-system, sans-serif',
          position:       'relative',
          overflow:       'hidden',
        }}
      >
        {/* ── Background gradient ───────────────────────────────────────── */}
        <div
          style={{
            position:   'absolute',
            inset:      0,
            background: `radial-gradient(ellipse 80% 60% at 50% 120%, ${accent}22 0%, transparent 70%)`,
          }}
        />

        {/* ── Top accent line ───────────────────────────────────────────── */}
        <div
          style={{
            position:   'absolute',
            top:        0,
            left:       0,
            right:      0,
            height:     4,
            background: `linear-gradient(90deg, ${accent}, ${accent}44)`,
          }}
        />

        {/* ── Content ───────────────────────────────────────────────────── */}
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            flex:           1,
            padding:        '64px 72px',
            justifyContent: 'space-between',
          }}
        >
          {/* Top: branding */}
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        12,
            }}
          >
            {/* Logo mark */}
            <div
              style={{
                width:           36,
                height:          36,
                borderRadius:    8,
                background:      accent,
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                fontSize:        18,
                color:           '#fff',
                fontWeight:      900,
              }}
            >
              P
            </div>
            <span
              style={{
                color:      'rgba(255,255,255,0.45)',
                fontSize:   18,
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              Pitch Engine
            </span>
          </div>

          {/* Middle: headline */}
          <div
            style={{
              display:       'flex',
              flexDirection: 'column',
              gap:           20,
            }}
          >
            {/* Deck title (smaller, muted) */}
            {displayTitle !== displayHeadline && (
              <p
                style={{
                  color:       'rgba(255,255,255,0.40)',
                  fontSize:    22,
                  fontWeight:  500,
                  margin:      0,
                  lineHeight:  1.3,
                }}
              >
                {displayTitle}
              </p>
            )}

            {/* Main headline (large, bold) */}
            <h1
              style={{
                color:       '#ffffff',
                fontSize:    displayHeadline.length > 40 ? 52 : 64,
                fontWeight:  800,
                lineHeight:  1.1,
                margin:      0,
                letterSpacing: '-0.02em',
              }}
            >
              {displayHeadline}
            </h1>
          </div>

          {/* Bottom: metadata row */}
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        24,
            }}
          >
            {/* Slide count badge */}
            <div
              style={{
                background:    `${accent}22`,
                border:        `1px solid ${accent}44`,
                borderRadius:  9999,
                padding:       '8px 18px',
                color:         accent,
                fontSize:      16,
                fontWeight:    600,
              }}
            >
              {slideLabel}
            </div>

            {/* "Tap to view" */}
            <span
              style={{
                color:      'rgba(255,255,255,0.30)',
                fontSize:   16,
                fontWeight: 400,
              }}
            >
              Tap to view →
            </span>
          </div>
        </div>

        {/* ── Right-side decorative bars (mobile screen silhouette) ─────── */}
        <div
          style={{
            position:      'absolute',
            right:         -20,
            top:           '50%',
            transform:     'translateY(-50%)',
            display:       'flex',
            flexDirection: 'column',
            gap:           12,
            opacity:       0.12,
          }}
        >
          {[180, 140, 100, 140, 180].map((w, i) => (
            <div
              key={i}
              style={{
                width:        w,
                height:       8,
                borderRadius: 4,
                background:   '#ffffff',
              }}
            />
          ))}
        </div>
      </div>
    ),
    {
      width:  WIDTH,
      height: HEIGHT,
    }
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function truncate(str, max) {
  if (!str) return ''
  return str.length <= max ? str : str.slice(0, max - 1) + '…'
}

function fallbackCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          WIDTH,
          height:         HEIGHT,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     '#0f0f0f',
          flexDirection:  'column',
          gap:            16,
        }}
      >
        <div
          style={{
            width:           56,
            height:          56,
            borderRadius:    12,
            background:      '#6366f1',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            fontSize:        28,
            color:           '#fff',
            fontWeight:      900,
          }}
        >
          P
        </div>
        <p style={{ color: '#ffffff', fontSize: 32, fontWeight: 700, margin: 0 }}>
          Pitch Engine
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, margin: 0 }}>
          Mobile-native story decks
        </p>
      </div>
    ),
    { width: WIDTH, height: HEIGHT }
  )
}
