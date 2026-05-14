'use client'

/**
 * StoryRenderer.jsx
 * Vertical swipe navigation (swipe up = next, swipe down = prev).
 * No tap zones — gesture-only on mobile, keyboard + buttons on desktop.
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StoryBlock from './StoryBlock'

// ─── Vertical transition variants ─────────────────────────────────────────────

const slideVariants = {
  enter: (direction) => ({
    y: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    y: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
}

const transition = {
  y: { type: 'spring', stiffness: 280, damping: 32 },
  opacity: { duration: 0.18 },
}

const SWIPE_THRESHOLD = 40  // px needed to register a swipe

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StoryRenderer({
  blocks = [],
  autoAdvanceMs = null,
  onSlideEnter = () => {},
  onSlideExit  = () => {},
  onComplete   = () => {},
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [direction, setDirection]     = useState(1)
  const [isPaused, setIsPaused]       = useState(false)

  const containerRef  = useRef(null)
  const enterTimeRef  = useRef(Date.now())
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 })
  const autoTimerRef  = useRef(null)

  const total = blocks.length

  // ─── Navigation ─────────────────────────────────────────────────────────────

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

  // ─── Auto-advance ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!autoAdvanceMs || isPaused) return
    autoTimerRef.current = setTimeout(goNext, autoAdvanceMs)
    return () => clearTimeout(autoTimerRef.current)
  }, [activeIndex, autoAdvanceMs, isPaused, goNext])

  // ─── Mount: fire slide 0 enter ───────────────────────────────────────────────

  useEffect(() => {
    enterTimeRef.current = Date.now()
    onSlideEnter(0, enterTimeRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Touch: vertical swipe ───────────────────────────────────────────────────

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }
    setIsPaused(true)
  }, [])

  const handleTouchEnd = useCallback((e) => {
    setIsPaused(false)
    const t  = e.changedTouches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y

    // Only handle if vertical motion dominates
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_THRESHOLD) {
      dy < 0 ? goNext() : goPrev()
    }
  }, [goNext, goPrev])

  // ─── Keyboard navigation ─────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (!blocks.length) {
    return (
      <div className="story-safe-container flex items-center justify-center bg-[#fafafa]">
        <p className="text-base text-gray-400">No slides to display.</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="story-safe-container relative overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Story deck"
      role="region"
    >
      {/* Right-side dot progress indicator */}
      <DotProgress total={total} activeIndex={activeIndex} />

      {/* Slide carousel */}
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
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.07}
            onDragEnd={(_, info) => {
              if (info.offset.y < -SWIPE_THRESHOLD) goNext()
              if (info.offset.y >  SWIPE_THRESHOLD) goPrev()
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

      {/* "Swipe up" hint on first slide */}
      {activeIndex === 0 && <SwipeHint />}

      {/* Desktop up/down buttons */}
      <DesktopNav
        onPrev={goPrev}
        onNext={goNext}
        showPrev={activeIndex > 0}
        showNext={activeIndex < total - 1}
      />
    </div>
  )
}

// ─── Right-side dot progress ──────────────────────────────────────────────────

function DotProgress({ total, activeIndex }) {
  return (
    <div
      className="absolute right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5"
      aria-label={`Slide ${activeIndex + 1} of ${total}`}
      role="progressbar"
      aria-valuenow={activeIndex + 1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width:           i === activeIndex ? 6 : 4,
            height:          i === activeIndex ? 6 : 4,
            backgroundColor: i === activeIndex ? '#111111' : 'rgba(0,0,0,0.2)',
          }}
        />
      ))}
    </div>
  )
}

// ─── Swipe up hint ────────────────────────────────────────────────────────────

function SwipeHint() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2500)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <motion.div
      className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-1 z-50 pointer-events-none"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      aria-hidden="true"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
        className="text-gray-400 text-xl"
      >
        ↑
      </motion.div>
      <span className="text-xs font-medium text-gray-400 tracking-widest uppercase">
        Swipe up
      </span>
    </motion.div>
  )
}

// ─── Desktop nav ──────────────────────────────────────────────────────────────

function DesktopNav({ onPrev, onNext, showPrev, showNext }) {
  return (
    <>
      {showPrev && (
        <button
          onClick={onPrev}
          className="hidden md:flex absolute top-6 left-1/2 -translate-x-1/2 z-50
                     w-10 h-10 rounded-full border border-black/10 bg-white/80
                     backdrop-blur-sm shadow items-center justify-center
                     text-gray-600 hover:text-black transition-colors"
          aria-label="Previous slide"
        >
          ↑
        </button>
      )}
      {showNext && (
        <button
          onClick={onNext}
          className="hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-50
                     w-10 h-10 rounded-full border border-black/10 bg-white/80
                     backdrop-blur-sm shadow items-center justify-center
                     text-gray-600 hover:text-black transition-colors"
          aria-label="Next slide"
        >
          ↓
        </button>
      )}
    </>
  )
}
