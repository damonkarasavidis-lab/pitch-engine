-- ─────────────────────────────────────────────────────────────────────────────
-- Pitch Engine — Supabase Schema
-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO USE:
--   1. Go to your Supabase project → SQL Editor → New query
--   2. Paste this entire file and click Run
--   3. You should see "Success. No rows returned" for each statement
--
-- Run this ONCE on a fresh project. If you need to reset, run the
-- DROP statements at the very bottom first.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── Extensions ──────────────────────────────────────────────────────────────
-- uuid_generate_v4() is used for primary keys.
-- Already enabled on most Supabase projects, but harmless to re-run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: decks
-- One row per story deck. The slug is the human-readable share key.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decks (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug             TEXT        NOT NULL UNIQUE,
  title            TEXT        NOT NULL DEFAULT 'Untitled Deck',
  meta_description TEXT,
  slide_count      INTEGER     NOT NULL DEFAULT 0,

  -- Optional: link to the auth.users table when you add login
  owner_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slug lookups are the hot path (every page view)
CREATE INDEX IF NOT EXISTS decks_slug_idx ON decks (slug);

-- Owner lookups for "my decks" dashboard
CREATE INDEX IF NOT EXISTS decks_owner_idx ON decks (owner_id);

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER decks_updated_at
  BEFORE UPDATE ON decks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: story_blocks
-- One row per slide within a deck. Ordered by order_index.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS story_blocks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id     UUID        NOT NULL REFERENCES decks(id) ON DELETE CASCADE,

  -- Block type — matches the StoryBlockType union in the app
  type        TEXT        NOT NULL CHECK (
                type IN ('headline', 'sub_headline', 'visual', 'proof_point', 'cta')
              ),

  order_index INTEGER     NOT NULL DEFAULT 0,

  -- Flexible content bag (text, bullets, mediaUrl, stat, ctaLabel, ctaUrl…)
  content     JSONB       NOT NULL DEFAULT '{}',

  -- Visual style overrides (bgColor, gradient, textColor, accentColor, layout)
  style_hints JSONB       NOT NULL DEFAULT '{}',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fetching all blocks for a deck is the most common query
CREATE INDEX IF NOT EXISTS story_blocks_deck_idx
  ON story_blocks (deck_id, order_index ASC);

-- JSONB index for content searches (e.g. find all CTAs by URL)
CREATE INDEX IF NOT EXISTS story_blocks_content_idx
  ON story_blocks USING GIN (content);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: analytics
-- One row per event (slide_enter, slide_exit, deck_complete, session_summary).
-- Designed for append-only writes via sendBeacon — no updates, no deletes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id     UUID        REFERENCES decks(id) ON DELETE CASCADE,

  -- Stable browser session identifier (generated client-side, stored in sessionStorage)
  session_id  TEXT        NOT NULL,

  -- Which slide this event relates to (null for session_summary / deck_complete)
  slide_index INTEGER,

  -- Event type
  event_type  TEXT        NOT NULL CHECK (
                event_type IN ('slide_enter', 'slide_exit', 'deck_complete', 'session_summary')
              ),

  entered_at  TIMESTAMPTZ,
  exited_at   TIMESTAMPTZ,

  -- Milliseconds spent on this slide (from the client-side timer)
  dwell_ms    INTEGER,

  -- Full raw event payload for future-proofing
  raw         JSONB,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dashboard query: all events for a deck
CREATE INDEX IF NOT EXISTS analytics_deck_idx
  ON analytics (deck_id, event_type);

-- Session lookup
CREATE INDEX IF NOT EXISTS analytics_session_idx
  ON analytics (session_id);

-- Time-series queries (e.g. views per day)
CREATE INDEX IF NOT EXISTS analytics_created_idx
  ON analytics (created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: analytics_per_slide
-- Called by GET /api/analytics to power the drop-off dashboard.
-- Returns average dwell time per slide index for a given deck.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION analytics_per_slide(p_deck_id UUID)
RETURNS TABLE (
  slide_index   INTEGER,
  sessions      BIGINT,
  avg_dwell_ms  NUMERIC,
  total_dwell_ms BIGINT
)
LANGUAGE sql STABLE AS $$
  SELECT
    slide_index,
    COUNT(DISTINCT session_id)   AS sessions,
    ROUND(AVG(dwell_ms), 0)      AS avg_dwell_ms,
    SUM(dwell_ms)                AS total_dwell_ms
  FROM  analytics
  WHERE deck_id   = p_deck_id
    AND event_type = 'slide_exit'
    AND slide_index IS NOT NULL
    AND dwell_ms    IS NOT NULL
  GROUP BY slide_index
  ORDER BY slide_index ASC;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
-- Strategy:
--   decks        → anyone can read (public share links); only owner can write
--   story_blocks → anyone can read; only service role can write (via API)
--   analytics    → no client reads; service role writes only
--
-- The /api/ingest and /api/analytics routes use SUPABASE_SERVICE_ROLE_KEY
-- which bypasses RLS entirely — so the INSERT policies below only matter
-- if you ever expose the anon key directly (don't).

ALTER TABLE decks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics    ENABLE ROW LEVEL SECURITY;

-- ── decks ─────────────────────────────────────────────────────────────────

-- Public read: anyone with the slug can view the deck
CREATE POLICY "decks: public read"
  ON decks FOR SELECT
  USING (true);

-- Authenticated write: only the deck owner can update/delete
-- (For now, this is permissive — tighten when you add auth)
CREATE POLICY "decks: owner write"
  ON decks FOR ALL
  USING (auth.uid() = owner_id OR owner_id IS NULL)
  WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);

-- ── story_blocks ──────────────────────────────────────────────────────────

-- Public read: blocks are readable if the parent deck is readable
CREATE POLICY "story_blocks: public read"
  ON story_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM decks WHERE decks.id = story_blocks.deck_id
    )
  );

-- ── analytics ─────────────────────────────────────────────────────────────
-- No anon access at all — the service role key handles all writes server-side.
-- If you want to add a "your analytics" dashboard for deck owners later,
-- add a SELECT policy checking auth.uid() against the deck's owner_id.


-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: smoke-test deck (optional — delete after confirming setup works)
-- ─────────────────────────────────────────────────────────────────────────────

-- Uncomment the lines below to insert a test deck you can immediately view
-- at http://localhost:3000/d/test-deck-0000

/*
INSERT INTO decks (slug, title, meta_description, slide_count)
VALUES (
  'test-deck-0000',
  'Test Deck',
  'A smoke-test deck to confirm the schema is working.',
  3
);

INSERT INTO story_blocks (deck_id, type, order_index, content, style_hints)
SELECT
  id,
  unnest(ARRAY['headline',   'sub_headline',    'cta'])         AS type,
  unnest(ARRAY[0,            1,                 2])             AS order_index,
  unnest(ARRAY[
    '{"text":"It works."}'::jsonb,
    '{"text":"Your Pitch Engine is live.","bullets":["Share decks via a single link","Track slide-by-slide engagement","Mobile-native from day one"]}'::jsonb,
    '{"text":"Ready to build?","ctaLabel":"Create your first deck","ctaUrl":"/create"}'::jsonb
  ]) AS content,
  unnest(ARRAY[
    '{"bgColor":"#0f0f0f","textColor":"#ffffff","accentColor":"#6366f1","layout":"centered"}'::jsonb,
    '{"bgGradient":"linear-gradient(135deg,#1a1a2e,#16213e)","textColor":"#e2e8f0","accentColor":"#38bdf8","layout":"centered"}'::jsonb,
    '{"bgColor":"#0d1117","textColor":"#f0f6fc","accentColor":"#6366f1","layout":"bottom"}'::jsonb
  ]) AS style_hints
FROM decks WHERE slug = 'test-deck-0000';
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- RESET (run these if you need a clean slate — DESTRUCTIVE)
-- ─────────────────────────────────────────────────────────────────────────────

/*
DROP FUNCTION IF EXISTS analytics_per_slide;
DROP TABLE  IF EXISTS analytics    CASCADE;
DROP TABLE  IF EXISTS story_blocks CASCADE;
DROP TABLE  IF EXISTS decks        CASCADE;
DROP FUNCTION IF EXISTS set_updated_at;
*/
