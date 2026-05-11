'use client'

/**
 * StoryRenderer.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a mobile-native "story deck" from an array of StoryBlock objects.
 *
 * Features:
 *  • Full-viewport-height sections (100dvh — dynamic viewport unit)
 *  • Segmented progress bar at the top
 *  • Tap-left / tap-right to advance (Instagram Stories pattern)
 *  • Scroll-to-advance (IntersectionObserver drives active index)
 *  • Framer Motion slide-over transitions
 *  • "Safe Zone" insets respecting iOS/Android browser chrome
 *  • Analytics hooks (onSlideEnter / onSlideExit callbacks)
 *
 * Usage:
 *  <StoryRenderer
 *    blocks={storyBlocks}
 *    onSlideEnter={(index, ts) => {}}
 *    onSlideExit={(index, ts, dwellMs) => {}}
 *  />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StoryBlock from './StoryBlock'

// ─── Transition variants ────────────────────────────────────────────────────

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
}

const transition = {
  x: { type: 'spring', stiffness: 300, damping: 30 },
  opacity: { duration: 0.15 },
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TAP_ZONE_THRESHOLD = 0.35  // left 35% = prev, right 65% = next
const SWIPE_THRESHOLD    = 50    // px required to register a swipe
const LONG_PRESS_MS      = 500   // hold to pause auto-advance (future)

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StoryRenderer({
  blocks = [],
  autoAdvanceMs = null,      // null = no auto-advance; number = interval ms
  onSlideEnter = () => {},
  onSlideExit  = () => {},
  onComplete   = () => {},
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection]     = useState(1)   // 1 = forward, -1 = back
  const [isPaused, setIsPaused]       = useState(false)

  const containerRef  = useRef(null)
  const slideRefs     = useRef([])
  const enterTimeRef  = useRef(Date.now())
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 })
  const autoTimerRef  = useRef(null)

  const total = blocks.length

  // ─── Navigation helpers ────────────────────────────────────────────────────

  const goTo = useCallback((nextIndex) => {
    if (nextIndex < 0 || nextIndex >= total) return

    const now     = Date.now()
    const dwellMs = now - enterTimeRef.current

    onSlideExit(activeIndex, now, dwellMs)

    setDirection(nextIndex > activeIndex ? 1 : -1)
    setActiveIndex(nextIndex)
    enterTimeRef.current = now
    onSlideEnter(nextIndex, now)

    if (nextIndex === total - 1) onComplete()
  }, [activeIndex, total, onSlideEnter, onSlideExit, onComplete])

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo])
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo])

  // ─── Auto-advance timer ────────────────────────────────────────────────────

  useEffect(() => {
    if (!autoAdvanceMs || isPaused) return
    autoTimerRef.current = setTimeout(goNext, autoAdvanceMs)
    return () => clearTimeout(autoTimerRef.current)
  }, [activeIndex, autoAdvanceMs, isPaused, goNext])

  // ─── Announce entry of slide 0 on mount ───────────────────────────────────

  useEffect(() => {
    enterTimeRef.current = Date.now()
    onSlideEnter(0, enterTimeRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Tap handler: left zone = prev, right zone = next ─────────────────────

  const handleTap = useCallback((e) => {
    // Ignore taps on interactive elements (buttons, links, inputs)
    if (e.target.closest('a, button, input, textarea, select')) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const relativeX = (e.clientX - rect.left) / rect.width
    if (relativeX <= TAP_ZONE_THRESHOLD) {
      goPrev()
    } else {
      goNext()
    }
  }, [goNext, goPrev])

  // ─── Touch / swipe handler ────────────────────────────────────────────────

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    touchStartRef.current = {
      x:    touch.clientX,
      y:    touch.clientY,
      time: Date.now(),
    }
    setIsPaused(true)
  }, [])

  const handleTouchEnd = useCallback((e) => {
    setIsPaused(false)
    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    const elapsed = Date.now() - touchStartRef.current.time

    // Horizontal swipe wins over vertical scroll
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      dx < 0 ? goNext() : goPrev()
      return
    }

    // Short tap (no significant movement, <300 ms)
    if (elapsed < 300 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const relX = (touch.clientX - rect.left) / rect.width
      relX <= TAP_ZONE_THRESHOLD ? goPrev() : goNext()
    }
  }, [goNext, goPrev])

  // ─── Keyboard navigation ──────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  // ─── Scroll-to-advance (IntersectionObserver) ─────────────────────────────
  // Each slide section is observed; when it crosses 60% visibility it becomes active.

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.index)
            if (idx !== activeIndex) goTo(idx)
          }
        })
      },
      { threshold: 0.6 }
    )

    slideRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [activeIndex, goTo, total])

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!blocks.length) {
    return (
      <div className="story-safe-container flex items-center justify-center bg-black text-white">
        <p className="text-lg opacity-50">No story blocks to display.</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="story-safe-container relative overflow-hidden select-none"
      onClick={handleTap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Story deck"
      role="region"
    >
      {/* ── Segmented Progress Bar ─────────────────────────────────────────── */}
      <ProgressBar
        total={total}
        activeIndex={activeIndex}
        autoAdvanceMs={autoAdvanceMs}
        isPaused={isPaused}
      />

      {/* ── Tap Zone Hint Overlay (shown briefly on first load) ────────────── */}
      <TapHintOverlay />

      {/* ── Slide Carousel ────────────────────────────────────────────────── */}
      <div className="relative w-full h-full">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={activeIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="absolute inset-0"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.x < -SWIPE_THRESHOLD) goNext()
              if (info.offset.x >  SWIPE_THRESHOLD) goPrev()
            }}
          >
            <StoryBlock
              block={blocks[activeIndex]}
              index={activeIndex}
              total={total}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Invisible scroll-target sections (for IntersectionObserver) ──── */}
      {/* Hidden off-screen; used only when the container is in scroll mode  */}
      <div className="story-scroll-sentinel" aria-hidden="true">
        {blocks.map((_, i) => (
          <div
            key={i}
            ref={(el) => (slideRefs.current[i] = el)}
            data-index={i}
            className="story-scroll-slide"
          />
        ))}
      </div>

      {/* ── Navigation chevrons (desktop / a11y) ──────────────────────────── */}
      <NavChevrons
        onPrev={goPrev}
        onNext={goNext}
        showPrev={activeIndex > 0}
        showNext={activeIndex < total - 1}
      />
    </div>
  )
}

// ─── ProgressBar Component ────────────────────────────────────────────────────

function ProgressBar({ total, activeIndex, autoAdvanceMs, isPaused }) {
  return (
    <div
      className="story-progress-bar"
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemax={total}
      aria-label={`Slide ${activeIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="story-progress-segment">
          <div
            className={[
              'story-progress-fill',
              i < activeIndex  ? 'story-progress-complete' : '',
              i === activeIndex ? 'story-progress-active'   : '',
            ].join(' ')}
            style={
              i === activeIndex && autoAdvanceMs && !isPaused
                ? { animationDuration: `${autoAdvanceMs}ms` }
                : {}
            }
          />
        </div>
      ))}
    </div>
  )
}

// ─── TapHintOverlay Component ─────────────────────────────────────────────────
// Fades in for 2s on first render to teach the tap-to-advance gesture.

function TapHintOverlay() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2200)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <motion.div
      className="story-tap-hint"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      aria-hidden="true"
    >
      <span className="story-tap-hint-left">‹ Prev</span>
      <span className="story-tap-hint-right">Next ›</span>
    </motion.div>
  )
}

// ─── NavChevrons Component ────────────────────────────────────────────────────
// Visible on desktop hover; hidden on touch devices via CSS.

function NavChevrons({ onPrev, onNext, showPrev, showNext }) {
  return (
    <>
      {showPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="story-nav-chevron story-nav-chevron--left"
          aria-label="Previous slide"
        >
          ‹
        </button>
      )}
      {showNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="story-nav-chevron story-nav-chevron--right"
          aria-label="Next slide"
        >
          ›
        </button>
      )}
    </>
  )
}
