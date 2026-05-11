'use client'

/**
 * useStoryAnalytics.js
 * ──────────────────────────────────────────────────────────────────────────────
 * React hook that tracks per-slide engagement metrics and flushes them to the
 * backend analytics endpoint.
 *
 * Tracked metrics per slide:
 *  • entered_at   (ISO timestamp)
 *  • exited_at    (ISO timestamp)
 *  • dwell_ms     (milliseconds spent on slide)
 *  • completed    (boolean — did the viewer reach the last slide?)
 *  • exit_slide   (index of the last slide seen before leaving)
 *
 * Usage:
 *
 *  const { onSlideEnter, onSlideExit, onComplete, summary } = useStoryAnalytics({
 *    deckId:    'deck_abc123',
 *    sessionId: 'sess_xyz',      // optional; auto-generated if omitted
 *    endpoint:  '/api/analytics' // default
 *  })
 *
 *  <StoryRenderer
 *    blocks={blocks}
 *    onSlideEnter={onSlideEnter}
 *    onSlideExit={onSlideExit}
 *    onComplete={onComplete}
 *  />
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useState, useCallback, useEffect } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSessionId() {
  return 'sess_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}

// Persist sessionId across remounts in the same browser tab
function getOrCreateSessionId(deckId) {
  if (typeof window === 'undefined') return generateSessionId()
  const key = `pitch_session_${deckId}`
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const id = generateSessionId()
  sessionStorage.setItem(key, id)
  return id
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param {object} options
 * @param {string}  options.deckId     - Supabase deck UUID
 * @param {string}  [options.sessionId]
 * @param {string}  [options.endpoint] - Analytics POST endpoint (default: /api/analytics)
 * @param {number}  [options.flushInterval] - Beacon interval in ms (default: 5000)
 * @param {boolean} [options.debug]    - Log events to console
 */
export function useStoryAnalytics({
  deckId,
  sessionId: providedSessionId,
  endpoint      = '/api/analytics',
  flushInterval = 5_000,
  debug         = false,
} = {}) {
  const sessionId = useRef(
    providedSessionId ?? getOrCreateSessionId(deckId ?? 'unknown')
  ).current

  // Queue of events waiting to be flushed
  const eventQueue = useRef([])

  // Per-slide dwell time accumulator: { [slideIndex]: totalMs }
  const dwellMap = useRef({})

  // Track if the viewer completed the deck
  const [completed, setCompleted]   = useState(false)
  const [lastSlide, setLastSlide]   = useState(0)
  const [summary, setSummary]       = useState(null)

  // ─── Enqueue an event ──────────────────────────────────────────────────────

  const enqueue = useCallback((event) => {
    eventQueue.current.push(event)
    if (debug) console.log('[Analytics]', event)
  }, [debug])

  // ─── Callbacks exposed to StoryRenderer ────────────────────────────────────

  const onSlideEnter = useCallback((index, timestamp) => {
    enqueue({
      type:        'slide_enter',
      deck_id:     deckId,
      session_id:  sessionId,
      slide_index: index,
      entered_at:  new Date(timestamp).toISOString(),
    })
    setLastSlide(index)
  }, [deckId, sessionId, enqueue])

  const onSlideExit = useCallback((index, timestamp, dwellMs) => {
    // Accumulate dwell time (handles rapid back-and-forth navigation)
    dwellMap.current[index] = (dwellMap.current[index] ?? 0) + dwellMs

    enqueue({
      type:        'slide_exit',
      deck_id:     deckId,
      session_id:  sessionId,
      slide_index: index,
      exited_at:   new Date(timestamp).toISOString(),
      dwell_ms:    dwellMs,
    })
  }, [deckId, sessionId, enqueue])

  const onComplete = useCallback(() => {
    setCompleted(true)
    enqueue({
      type:       'deck_complete',
      deck_id:    deckId,
      session_id: sessionId,
      completed_at: new Date().toISOString(),
    })
    // Flush immediately on completion
    flush()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, sessionId, enqueue])

  // ─── Summary computation ────────────────────────────────────────────────────

  const computeSummary = useCallback(() => {
    const entries     = Object.entries(dwellMap.current)
    const totalDwellMs = entries.reduce((sum, [, ms]) => sum + ms, 0)
    const slidesSeen  = entries.filter(([, ms]) => ms > 0).length

    return {
      session_id:      sessionId,
      deck_id:         deckId,
      slides_seen:     slidesSeen,
      total_dwell_ms:  totalDwellMs,
      completion_rate: entries.length > 0
        ? Math.round((slidesSeen / Object.keys(dwellMap.current).length) * 100)
        : 0,
      completed,
      dwell_by_slide:  { ...dwellMap.current },
    }
  }, [sessionId, deckId, completed])

  // ─── Flush queue to backend ─────────────────────────────────────────────────

  const flush = useCallback(async () => {
    if (!eventQueue.current.length) return

    const batch = eventQueue.current.splice(0)  // drain queue atomically
    const sum   = computeSummary()
    setSummary(sum)

    try {
      // Use sendBeacon when available — survives page unload
      const payload = JSON.stringify({ events: batch, summary: sum })

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon(endpoint, blob)
      } else {
        await fetch(endpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    payload,
          keepalive: true,   // survives navigation on modern browsers
        })
      }
    } catch (err) {
      // Re-queue events on failure (fire-and-forget; don't block UX)
      eventQueue.current.unshift(...batch)
      if (debug) console.warn('[Analytics] flush failed, re-queued:', err.message)
    }
  }, [endpoint, computeSummary, debug])

  // ─── Periodic flush ────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(flush, flushInterval)
    return () => clearInterval(interval)
  }, [flush, flushInterval])

  // ─── Flush on page hide (tab switch / close / navigate away) ──────────────

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const onPageHide = () => flush()

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [flush])

  return {
    onSlideEnter,
    onSlideExit,
    onComplete,
    summary,
    sessionId,
  }
}
