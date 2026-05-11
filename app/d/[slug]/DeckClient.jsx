'use client'

/**
 * app/d/[slug]/DeckClient.jsx  — Deck Viewer (Client Component)
 * ──────────────────────────────────────────────────────────────────────────────
 * Mounts the interactive StoryRenderer and wires it up to the analytics hook.
 * This is a client component because StoryRenderer uses browser APIs
 * (IntersectionObserver, touch events, Framer Motion animations).
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react'
import StoryRenderer           from '@/components/StoryRenderer'
import { useStoryAnalytics }   from '@/hooks/useStoryAnalytics'

export default function DeckClient({ deckId, blocks, title }) {
  const [isReady, setIsReady] = useState(false)

  // Slight delay so the mobile browser has finished its initial layout
  // before we mount the full animation stack — avoids a first-frame jank.
  useEffect(() => {
    const t = requestAnimationFrame(() => setIsReady(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const { onSlideEnter, onSlideExit, onComplete } = useStoryAnalytics({
    deckId,
    endpoint: '/api/analytics',
    debug:    process.env.NODE_ENV === 'development',
  })

  if (!isReady) {
    return <DeckSkeleton />
  }

  return (
    <StoryRenderer
      blocks={blocks}
      onSlideEnter={onSlideEnter}
      onSlideExit={onSlideExit}
      onComplete={onComplete}
    />
  )
}

// ── Loading skeleton ───────────────────────────────────────────────────────
// Shown for one frame while the component hydrates.
// Matches the dark background so there's no flash of white.

function DeckSkeleton() {
  return (
    <div
      className="story-safe-container bg-[#0f0f0f]"
      aria-label="Loading deck…"
      aria-busy="true"
    >
      {/* Skeleton progress bar */}
      <div className="story-progress-bar" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="story-progress-segment opacity-20" />
        ))}
      </div>

      {/* Pulsing content placeholder */}
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
        <div className="w-3/4 h-10 rounded-lg bg-white/10 animate-pulse" />
        <div className="w-full h-5  rounded-lg bg-white/10 animate-pulse" />
        <div className="w-5/6 h-5  rounded-lg bg-white/10 animate-pulse" />
        <div className="w-2/3 h-5  rounded-lg bg-white/10 animate-pulse" />
      </div>
    </div>
  )
}
