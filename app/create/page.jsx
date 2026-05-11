'use client'

/**
 * app/create/page.jsx — Deck Creation UI
 * ──────────────────────────────────────────────────────────────────────────────
 * Two input modes:
 *  A. Upload — drag-and-drop or click to upload .pptx, .docx, .pdf
 *  B. Paste  — type/paste Markdown or plain text
 *
 * Three display states:
 *  1. IDLE     — input mode tabs + form
 *  2. LOADING  — animated processing screen
 *  3. SUCCESS  — share URL + copy button
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence }        from 'framer-motion'

// ── Sample content ────────────────────────────────────────────────────────────
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

const FORMATS = [
  {
    value: 'markdown',
    label: 'Markdown',
    hint: '# Headings → slides, - bullets → points, > quotes → proof',
  },
  {
    value: 'text',
    label: 'Plain text',
    hint: 'Paste any text — AI structures it into slides',
  },
]

const STEPS = [
  'Reading your file…',
  'Extracting content…',
  'Identifying story blocks…',
  'Condensing to mobile copy…',
  'Saving your deck…',
  'Generating share link…',
]

const ACCEPTED = '.pptx,.docx,.pdf'
const ACCEPTED_MIME = [
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const [mode, setMode]       = useState('upload')  // 'upload' | 'paste'
  const [state, setState]     = useState('idle')     // 'idle' | 'loading' | 'success' | 'error'
  const [title, setTitle]     = useState('')
  const [format, setFormat]   = useState('markdown')
  const [content, setContent] = useState('')
  const [file, setFile]       = useState(null)       // File object
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult]   = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [step, setStep]       = useState(0)
  const [copied, setCopied]   = useState(false)

  const fileInputRef = useRef(null)
  const stepTimer    = useRef(null)

  // ── Step animation ───────────────────────────────────────────────────────
  function startStepAnimation() {
    let i = 0
    setStep(0)
    stepTimer.current = setInterval(() => {
      i += 1
      if (i < STEPS.length) setStep(i)
      else clearInterval(stepTimer.current)
    }, 800)
  }

  // ── File validation ──────────────────────────────────────────────────────
  function validateFile(f) {
    if (!f) return 'No file selected.'
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['pptx', 'docx', 'pdf'].includes(ext)) {
      return 'Only .pptx, .docx, and .pdf files are supported.'
    }
    if (f.size > 20 * 1024 * 1024) {
      return 'File is too large. Maximum size is 20MB.'
    }
    return null
  }

  // ── Drag and drop ────────────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (!dropped) return
    const err = validateFile(dropped)
    if (err) { setErrorMsg(err); setState('error'); return }
    setFile(dropped)
    setErrorMsg('')
    setState('idle')
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleFileInput = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    const err = validateFile(selected)
    if (err) { setErrorMsg(err); setState('error'); return }
    setFile(selected)
    setErrorMsg('')
    setState('idle')
  }

  // ── Submit: file upload ──────────────────────────────────────────────────
  async function handleUploadSubmit(e) {
    e.preventDefault()
    if (!file) return

    setState('loading')
    setErrorMsg('')
    startStepAnimation()

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title.trim())

      const res = await fetch('/api/upload', { method: 'POST', body: fd })
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

  // ── Submit: paste ────────────────────────────────────────────────────────
  async function handlePasteSubmit(e) {
    e.preventDefault()
    if (!content.trim()) return

    setState('loading')
    setErrorMsg('')
    startStepAnimation()

    try {
      const res = await fetch('/api/ingest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), format, title: title.trim(), transform: true }),
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

  // ── Copy URL ─────────────────────────────────────────────────────────────
  async function copyUrl() {
    if (!result?.shareUrl) return
    await navigator.clipboard.writeText(result.shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  function reset() {
    setState('idle')
    setContent('')
    setTitle('')
    setFile(null)
    setResult(null)
    setErrorMsg('')
  }

  // ── File type label ──────────────────────────────────────────────────────
  const fileExt = file?.name.split('.').pop().toUpperCase()

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-start px-4 py-12 overflow-y-auto">

      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <a href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors">
          ← Pitch Engine
        </a>
        <h1 className="text-3xl font-extrabold text-white mt-4 tracking-tight">
          Create a deck
        </h1>
        <p className="text-white/50 mt-2 text-base">
          Upload a file or paste your content — we'll turn it into a mobile story deck.
        </p>
      </div>

      <AnimatePresence mode="wait">

        {/* ── IDLE / ERROR: main form ──────────────────────────────────── */}
        {(state === 'idle' || state === 'error') && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-2xl flex flex-col gap-6"
          >
            {/* Title input */}
            <div className="flex flex-col gap-2">
              <label className="text-white/60 text-sm font-medium" htmlFor="title">
                Deck title <span className="text-white/30">(optional)</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Series A Pitch"
                maxLength={80}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder-white/25 text-base
                           focus:outline-none focus:border-indigo-500/60 transition-colors"
              />
            </div>

            {/* Mode tabs */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
              {[
                { id: 'upload', label: '↑ Upload file', sub: 'PPTX · DOCX · PDF' },
                { id: 'paste',  label: '✎ Paste text',  sub: 'Markdown · Plain text' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setMode(tab.id); setState('idle'); setErrorMsg('') }}
                  className={[
                    'flex-1 flex flex-col items-center py-3 rounded-lg text-sm font-semibold transition-all',
                    mode === tab.id
                      ? 'bg-indigo-500/20 text-white border border-indigo-500/40'
                      : 'text-white/40 hover:text-white/60',
                  ].join(' ')}
                >
                  {tab.label}
                  <span className="text-xs font-normal opacity-60 mt-0.5">{tab.sub}</span>
                </button>
              ))}
            </div>

            {/* ── Upload zone ─────────────────────────────────────────── */}
            {mode === 'upload' && (
              <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={[
                    'relative flex flex-col items-center justify-center gap-3',
                    'rounded-2xl border-2 border-dashed cursor-pointer',
                    'transition-all py-14 px-6 text-center',
                    dragOver
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : file
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-white/15 bg-white/3 hover:border-white/30 hover:bg-white/5',
                  ].join(' ')}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED}
                    onChange={handleFileInput}
                    className="sr-only"
                  />

                  {file ? (
                    <>
                      {/* File selected state */}
                      <div className="w-14 h-14 rounded-xl bg-emerald-500/15 border border-emerald-500/30
                                      flex items-center justify-center text-emerald-400 text-xs font-bold tracking-widest">
                        {fileExt}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{file.name}</p>
                        <p className="text-white/40 text-xs mt-1">
                          {(file.size / 1024 / 1024).toFixed(2)}MB — click to change
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Empty state */}
                      <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10
                                      flex items-center justify-center text-2xl text-white/30">
                        ↑
                      </div>
                      <div>
                        <p className="text-white/70 font-medium text-sm">
                          Drop your file here, or click to browse
                        </p>
                        <p className="text-white/30 text-xs mt-1">
                          PowerPoint (.pptx) · Word (.docx) · PDF — max 20MB
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Error */}
                {state === 'error' && errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    <p className="text-red-400 text-sm">{errorMsg}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!file}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30
                             disabled:cursor-not-allowed transition-colors
                             text-white font-bold text-base py-4 rounded-xl"
                >
                  Convert to deck →
                </button>
              </form>
            )}

            {/* ── Paste zone ──────────────────────────────────────────── */}
            {mode === 'paste' && (
              <form onSubmit={handlePasteSubmit} className="flex flex-col gap-4">

                {/* Format picker */}
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

                {/* Textarea */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-white/60 text-sm font-medium" htmlFor="content">Content</label>
                    <button
                      type="button"
                      onClick={() => { setContent(SAMPLE_MARKDOWN); setFormat('markdown') }}
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
                        : 'Paste any text here — a brief, a doc, notes…'
                    }
                    rows={14}
                    required
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3
                               text-white placeholder-white/20 text-sm font-mono leading-relaxed
                               focus:outline-none focus:border-indigo-500/60
                               transition-colors resize-none"
                  />
                  <p className="text-white/25 text-xs text-right">{content.length.toLocaleString()} chars</p>
                </div>

                {/* Error */}
                {state === 'error' && errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    <p className="text-red-400 text-sm">{errorMsg}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!content.trim()}
                  className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30
                             disabled:cursor-not-allowed transition-colors
                             text-white font-bold text-base py-4 rounded-xl"
                >
                  Create deck →
                </button>
              </form>
            )}
          </motion.div>
        )}

        {/* ── LOADING ─────────────────────────────────────────────────── */}
        {state === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl flex flex-col items-center gap-8 py-16"
          >
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-white/10" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent
                              border-t-indigo-500 animate-spin" />
            </div>
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
                  <span className="text-base">{i < step ? '✓' : i === step ? '›' : '·'}</span>
                  {s}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── SUCCESS ─────────────────────────────────────────────────── */}
        {state === 'success' && result && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl flex flex-col gap-6"
          >
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30
                              flex items-center justify-center text-2xl">✓</div>
              <h2 className="text-2xl font-bold text-white">Deck created</h2>
              <p className="text-white/50 text-sm">
                {result.slideCount} slides · ready to share
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
              <p className="flex-1 text-white text-sm font-mono truncate">{result.shareUrl}</p>
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

            <div className="grid grid-cols-2 gap-3">
              <a
                href={result.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white text-black
                           font-bold py-3 rounded-xl hover:bg-white/90 transition-colors text-sm"
              >
                Open deck ↗
              </a>
              <button
                onClick={reset}
                className="flex items-center justify-center border border-white/15
                           text-white/60 font-medium py-3 rounded-xl
                           hover:border-white/30 hover:text-white transition-all text-sm"
              >
                Create another
              </button>
            </div>

            <div className="border-t border-white/10 pt-4 flex gap-6 text-xs text-white/30">
              <span>Slug: <span className="text-white/50 font-mono">{result.slug}</span></span>
              {result.sourceFile && (
                <span>Source: <span className="text-white/50 font-mono">{result.sourceFile}</span></span>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </main>
  )
}
