/**
 * app/api/analytics/route.js  (Next.js App Router)
 * ──────────────────────────────────────────────────────────────────────────────
 * Receives analytics event batches from the client and persists them to
 * Supabase. Designed to be called by both:
 *   • fetch() with keepalive: true
 *   • navigator.sendBeacon() (body is a Blob — handled via request.blob())
 *
 * Table schema (run in Supabase SQL editor):
 *
 *   CREATE TABLE analytics (
 *     id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     deck_id       UUID REFERENCES decks(id) ON DELETE CASCADE,
 *     session_id    TEXT NOT NULL,
 *     slide_index   INTEGER,
 *     event_type    TEXT NOT NULL,
 *     entered_at    TIMESTAMPTZ,
 *     exited_at     TIMESTAMPTZ,
 *     dwell_ms      INTEGER,
 *     raw           JSONB,
 *     created_at    TIMESTAMPTZ DEFAULT now()
 *   );
 *
 *   -- Index for dashboard queries
 *   CREATE INDEX analytics_deck_id_idx ON analytics (deck_id);
 *   CREATE INDEX analytics_session_idx ON analytics (session_id);
 *
 *   -- Enable RLS (service-role key bypasses this; anon cannot read)
 *   ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'
import { NextResponse }  from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY   // service-role: server only, bypasses RLS
)

export async function POST(request) {
  let body

  try {
    // sendBeacon sends a Blob; fetch sends JSON. Handle both.
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      body = await request.json()
    } else {
      const text = await request.text()
      body = JSON.parse(text)
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { events = [], summary = {} } = body

  if (!events.length && !summary.session_id) {
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  // ── Map events to DB rows ──────────────────────────────────────────────────

  const rows = events
    .filter((e) => ['slide_enter', 'slide_exit', 'deck_complete'].includes(e.type))
    .map((e) => ({
      deck_id:     e.deck_id     ?? summary.deck_id ?? null,
      session_id:  e.session_id  ?? summary.session_id,
      slide_index: e.slide_index ?? null,
      event_type:  e.type,
      entered_at:  e.entered_at  ?? null,
      exited_at:   e.exited_at   ?? null,
      dwell_ms:    e.dwell_ms    ?? null,
      raw:         e,
    }))

  // ── Also upsert a session-level summary row ────────────────────────────────
  // This makes dashboard queries trivially cheap — one row per session.

  if (summary.session_id) {
    rows.push({
      deck_id:     summary.deck_id    ?? null,
      session_id:  summary.session_id,
      slide_index: null,
      event_type:  'session_summary',
      entered_at:  null,
      exited_at:   null,
      dwell_ms:    summary.total_dwell_ms ?? null,
      raw:         summary,
    })
  }

  if (!rows.length) {
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  const { error, count } = await supabase
    .from('analytics')
    .insert(rows, { count: 'exact' })

  if (error) {
    console.error('[analytics/route] Supabase insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, inserted: count })
}

// ── GET: Simple dashboard aggregate endpoint ───────────────────────────────
// Returns per-slide average dwell + completion rate for a deck.
// Protect this with auth middleware in production.

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const deckId = searchParams.get('deck_id')

  if (!deckId) {
    return NextResponse.json({ error: 'deck_id required' }, { status: 400 })
  }

  // Aggregate: per-slide average dwell
  const { data: dwellData, error: dwellError } = await supabase
    .rpc('analytics_per_slide', { p_deck_id: deckId })

  // Session count + completion rate
  const { data: sessions, error: sessError } = await supabase
    .from('analytics')
    .select('session_id, raw')
    .eq('deck_id', deckId)
    .eq('event_type', 'session_summary')

  if (dwellError || sessError) {
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const totalSessions   = sessions?.length ?? 0
  const completedCount  = sessions?.filter((s) => s.raw?.completed).length ?? 0
  const completionRate  = totalSessions
    ? Math.round((completedCount / totalSessions) * 100)
    : 0

  return NextResponse.json({
    deck_id:         deckId,
    total_sessions:  totalSessions,
    completion_rate: completionRate,
    per_slide_dwell: dwellData ?? [],
  })
}
