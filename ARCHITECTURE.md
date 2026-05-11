# Mobile-First Pitch Engine — System Architecture

## Overview

The Pitch Engine is a Next.js application that ingests raw content (Markdown, JSON, PDF text)
and transforms it into mobile-native "story decks" — full-viewport vertical-scroll experiences
optimised for 6.1-inch screens and shareable via a unique lightweight URL.

---

## High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser / Mobile)                   │
│                                                                       │
│  ┌───────────────┐   ┌──────────────────┐   ┌─────────────────────┐ │
│  │  Ingest UI    │   │  StoryRenderer   │   │  Analytics Overlay  │ │
│  │ (Paste / Drop │──▶│  (Framer Motion  │   │  (slide timers,     │ │
│  │  / URL input) │   │   tap/scroll)    │   │   completion rate)  │ │
│  └──────┬────────┘   └────────┬─────────┘   └────────┬────────────┘ │
│         │                     │                       │              │
└─────────┼─────────────────────┼───────────────────────┼──────────────┘
          │ POST /api/ingest     │ GET /deck/:id          │ POST /api/analytics
          ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS API ROUTES (Node.js)                  │
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │  /api/ingest    │  │  /api/transform  │  │  /api/analytics  │    │
│  │                 │  │                  │  │                  │    │
│  │ 1. Parse MD/JSON│  │ 1. Chunk content │  │ 1. Receive slide │    │
│  │ 2. Identify     │  │ 2. Call LLM API  │  │    view events   │    │
│  │    StoryBlocks  │  │ 3. Return punchy │  │ 2. Upsert to     │    │
│  │ 3. Generate     │  │    bullets       │  │    Supabase      │    │
│  │    deck_id      │  └────────┬─────────┘  └────────┬─────────┘    │
│  │ 4. Persist deck │           │                      │             │
│  └────────┬────────┘           │                      │             │
│           │                    │                      │             │
└───────────┼────────────────────┼──────────────────────┼─────────────┘
            │                    │                       │
            ▼                    ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                             SUPABASE                                  │
│                                                                       │
│  ┌──────────────────┐   ┌────────────────────┐   ┌───────────────┐  │
│  │  decks           │   │  story_blocks       │   │  analytics    │  │
│  │                  │   │                     │   │               │  │
│  │  id (uuid)       │   │  id                 │   │  deck_id      │  │
│  │  slug (short)    │   │  deck_id (fk)       │   │  session_id   │  │
│  │  title           │   │  type (enum)        │   │  slide_index  │  │
│  │  meta_image      │   │  order_index        │   │  entered_at   │  │
│  │  created_at      │   │  content (jsonb)    │   │  exited_at    │  │
│  │  owner_id        │   │  style_hints (jsonb)│   │  dwell_ms     │  │
│  └──────────────────┘   └────────────────────┘   └───────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          LLM (Anthropic / OpenAI)                    │
│                                                                       │
│  Input:  Raw long-form text (up to 4 000 tokens per chunk)           │
│  Output: Array of { headline, bullets[], cta? } — max 15 words each  │
│  Called: Server-side only (key never exposed to client)              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Ingest → Publish

```
User pastes Markdown / drops PDF
        │
        ▼
POST /api/ingest
  └─ contentParser.ts          ← splits into raw StoryBlocks
        │
        ▼
POST /api/transform (internal)
  └─ llmTransformer.ts         ← condenses each block to ≤15 words/bullet
        │
        ▼
Supabase INSERT deck + story_blocks
        │
        ▼
Return { deckId, slug, shareUrl }
        │
        ▼
Client renders /deck/[slug]
  └─ StoryRenderer.tsx         ← full-viewport story experience
  └─ useStoryAnalytics.ts      ← tracks dwell time per slide
        │
        ▼
Analytics events → POST /api/analytics → Supabase analytics table
```

---

## URL & Metadata Strategy (Link Unfurling)

Each deck gets a canonical URL: `https://pitch.yourdomain.com/d/[slug]`

The `/d/[slug]` Next.js page uses `generateMetadata()` to inject:

```html
<!-- Open Graph (WhatsApp, iMessage, Slack) -->
<meta property="og:title"       content="[deck title]" />
<meta property="og:description" content="[first slide headline]" />
<meta property="og:image"       content="[CDN-hosted meta card image]" />
<meta property="og:url"         content="https://pitch.yourdomain.com/d/[slug]" />
<meta property="og:type"        content="website" />

<!-- Twitter Card -->
<meta name="twitter:card"       content="summary_large_image" />
<meta name="twitter:title"      content="[deck title]" />
<meta name="twitter:image"      content="[CDN-hosted meta card image]" />

<!-- iMessage / WhatsApp specific -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

The `meta_image` is generated server-side using `@vercel/og` (Satori) at build time,
producing a branded 1200×630 JPEG from the deck's first slide content.

---

## StoryBlock Type System

```typescript
type StoryBlockType =
  | 'headline'      // Large bold statement, ≤8 words
  | 'sub_headline'  // Supporting context, ≤15 words
  | 'visual'        // Full-bleed image or video background
  | 'proof_point'   // Stat / quote / social proof with source
  | 'cta'           // Call-to-action with button

interface StoryBlock {
  id: string
  type: StoryBlockType
  order_index: number
  content: {
    text?: string
    bullets?: string[]         // max 3 bullets, ≤15 words each
    mediaUrl?: string
    mediaAlt?: string
    stat?: string              // e.g. "10× faster"
    source?: string
    ctaLabel?: string
    ctaUrl?: string
  }
  style_hints: {
    bgColor?: string           // tailwind class or hex
    textColor?: string
    accentColor?: string
    bgGradient?: string
    layout?: 'centered' | 'top' | 'bottom' | 'split'
  }
}
```

---

## Tech Stack

| Layer        | Technology                             | Reason                                    |
|--------------|----------------------------------------|-------------------------------------------|
| Framework    | Next.js 14 (App Router)                | SSR for meta tags, API routes, edge-ready |
| Styling      | Tailwind CSS v3                        | Rapid utility-first mobile styling        |
| Animation    | Framer Motion 11                       | Declarative slide transitions             |
| Database     | Supabase (Postgres + Realtime)         | Instant REST/realtime + auth built-in     |
| LLM          | Anthropic Claude (claude-haiku-4-5)    | Fast, cheap summarisation                 |
| OG Images    | @vercel/og (Satori)                    | Server-side card generation               |
| Hosting      | Vercel (Edge Network)                  | Near-zero latency globally                |
| Analytics    | Custom (Supabase) + optional Amplitude | Full ownership of engagement data         |
