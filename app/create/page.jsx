'use client'

/**
 * app/create/page.jsx — Deck Creation UI
 * ──────────────────────────────────────────────────────────────────────────────
 * Three states:
 *  1. IDLE     — form: title + format picker + content textarea + submit
 *  2. LOADING  — animated processing screen while /api/ingest runs
 *  3. SUCCESS  — share URL displayed with copy button + preview link
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Sample content so the user can try it immediately ─────────────────────
const SAMPLE_MARKDOWN = `# Your pitch in seconds

## The problem
Most presentations are built for laptops — not the phones where decisions actually get made.

- 90% of pitches are read on mobile
- Tiny text, pinch-to-zoom, broken layouts
- Your idea deserves better

## The solution
Pitch Engine converts your content into a mobile-native story deck — tap through it like Instagram Stories.

> 3× higher engagement — internal beta, May 2026

## How it works
- Paste your content here
- We parse and transform it into punchy slides
- Share a single link — works in WhatsApp, Slack, iMessage

## Get started today

[Book a demo](https://example.com/demo)
`

// ── Format options ─────────────────────────────────────────────────────────
const FORMATS = [
  {
    value: 'markdown',
    label: 'Markdown',
    hint: '# Headings → slides, - bullets → bullet points, > quotes → proof points',
  },
  {
    value: 'text',
    label: 'Plain text',
    hint: 'Paste any text — the AI will structure it into slides for you',
  },
]

// ── Processing steps shown during loading ──────────────────────────────────
const STEPS = [
  'Parsing your content…',
  'Identifying story blocks…',
  'Condensing to mobile copy…',
  'Saving your deck…',
  'Generating share link…',
]

export default function CreatePage() {
  const [state, setState]     = useState('idle')   // 'idle' | 'loading' | 'success' | 'error'
  const [title, setTitle]     = useState('')
  const [format, setFormat]   = useState('markdown')
  const [content, setContent] = useState('')
  const [result, setResult]   = useState(null)     // { deckId, slug, shareUrl }
  const [errorMsg, setErrorMsg] = useState('')
  const [step, setStep]       = useState(0)
  const [copied, setCopied]   = useState(false)
  const stepTimer             = useRef(null)

  // ── Animate through the loading steps ────────────────────────────────────
  function startStepAnimation() {
    let i = 0
    setStep(0)
    stepTimer.current = setInterval(() => {
      i += 1
      if (i < STEPS.length) setStep(i)
      else clearInterval(stepTimer.current)
    }, 900)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()

    if (!content.trim()) return

    setState('loading')
    setErrorMsg('')
    startStepAnimation()

    try {
      const res = await fetch('/api/ingest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content:   content.trim(),
          format,
          title:     title.trim(),
          transform: true,
        }),
      })

      clearInterval(stepTimer.current)

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Server error ${res.status}`)
      }

      const data = await res.json()
      setResult(data)
      setState('success')
    } catch (err) {
      clearInterval(stepTimer.current)
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
      setState('error')
    }
  }

  // ── Copy share URL ────────────────────────────────────────────────────────
  async function copyUrl() {
    if (!result?.shareUrl) return
    await navigator.clipboard.writeText(result.shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Load sample content ───────────────────────────────────────────────────
  function loadSample() {
    setContent(SAMPLE_MARKDOWN)
    setFormat('markdown')
    setTitle('Mobile Pitch Engine')
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-start px-4 py-12 overflow-y-auto overscroll-y-auto">

      {/* Header */}
      <div className="w-full max-w-2xl mb-10">
        <a href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors">
          ← Pitch Engine
        </a>
        <h1 className="text-3xl font-extrabold text-white mt-4 tracking-tight">
          Create a deck
        </h1>
        <p className="text-white/50 mt-2 text-base">
          Paste your content below — we'll turn it into a mobile story deck.
        </p>
      </div>

      <AnimatePresence mode="wait">

        {/* ── IDLE: form ──────────────────────────────────────────────────── */}
        {(state === 'idle' || state === 'error') && (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            onSubmit={handleSubmit}
            className="w-full max-w-2xl flex flex-col gap-6"
          >
            {/* Title */}
            <div className="flex flex-col gap-2">
              <label className="text-white/60 text-sm font-medium" htmlFor="title">
                Deck title <span className="text-white/30">(optional)</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 Investor Update"
                maxLength={80}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder-white/25 text-base
                           focus:outline-none focus:border-indigo-500/60
                           transition-colors"
              />
            </div>

            {/* Format picker */}
            <div className="flex flex-col gap-2">
              <span className="text-white/60 text-sm font-medium">Content format</span>
              <div className="grid grid-cols-2 gap-3">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFormat(f.value)}
                    className={[
                      'flex flex-col gap-1 text-left p-4 rounded-xl border transition-all',
                      format === f.value
                        ? 'border-indigo-500/70 bg-indigo-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20',
                    ].join(' ')}
                  >
                    <span className="font-semibold text-sm">{f.label}</span>
                    <span className="text-xs leading-relaxed opacity-70">{f.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content textarea */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-white/60 text-sm font-medium" htmlFor="content">
                  Content
                </label>
                <button
                  type="button"
                  onClick={loadSample}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Load sample ↗
                </button>
              </div>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  format === 'markdown'
                    ? '# Your headline\n\n## A key point\n- Bullet one\n- Bullet two\n\n> A proof point — Source'
                    : 'Paste any text here — a brief, a doc, a script…'
                }
                rows={14}
                required
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder-white/20 text-sm font-mono leading-relaxed
                           focus:outline-none focus:border-indigo-500/60
                           transition-colors resize-none"
              />
              <p className="text-white/25 text-xs text-right">
                {content.length.toLocaleString()} chars
              </p>
            </div>

            {/* Error message */}
            {state === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{errorMsg}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!content.trim()}
              className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30
                         disabled:cursor-not-allowed transition-colors
                         text-white font-bold text-base py-4 rounded-xl"
            >
              Create deck →
            </button>
          </motion.form>
        )}

        {/* ── LOADING ─────────────────────────────────────────────────────── */}
        {state === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl flex flex-col items-center gap-8 py-16"
          >
            {/* Spinner */}
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-white/10" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent
                              border-t-indigo-500 animate-spin" />
            </div>

            {/* Animated step list */}
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={[
                    'flex items-center gap-3 text-sm transition-all duration-500',
                    i < step  ? 'text-white/40'  : '',
                    i === step ? 'text-white'     : '',
                    i > step  ? 'text-white/15'  : '',
                  ].join(' ')}
                >
                  <span className="text-base">
                    {i < step ? '✓' : i === step ? '›' : '·'}
                  </span>
                  {s}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── SUCCESS ─────────────────────────────────────────────────────── */}
        {state === 'success' && result && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl flex flex-col gap-6"
          >
            {/* Tick */}
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30
                              flex items-center justify-center text-2xl">
                ✓
              </div>
              <h2 className="text-2xl font-bold text-white">Deck created</h2>
              <p className="text-white/50 text-sm">
                Your story deck is live and ready to share.
              </p>
            </div>

            {/* Share URL box */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <p className="flex-1 text-white text-sm font-mono truncate">
                {result.shareUrl}
              </p>
              <button
                onClick={copyUrl}
                className={[
                  'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                  copied
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30',
                ].join(' ')}
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={result.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2
                           bg-white text-black font-bold py-3 rounded-xl
                           hover:bg-white/90 transition-colors text-sm"
              >
                Open deck ↗
              </a>
              <button
                onClick={() => {
                  setState('idle')
                  setContent('')
                  setTitle('')
                  setResult(null)
                }}
                className="flex items-center justify-center
                           border border-white/15 text-white/60 font-medium py-3 rounded-xl
                           hover:border-white/30 hover:text-white transition-all text-sm"
              >
                Create another
              </button>
            </div>

            {/* Deck metadata */}
            <div className="border-t border-white/10 pt-4 flex gap-6 text-xs text-white/30">
              <span>Slug: <span className="text-white/50 font-mono">{result.slug}</span></span>
              <span>ID: <span className="text-white/50 font-mono">{result.deckId?.slice(0, 8)}…</span></span>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </main>
  )
}
