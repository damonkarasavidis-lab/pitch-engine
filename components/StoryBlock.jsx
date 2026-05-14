'use client'

/**
 * StoryBlock.jsx
 * Light & clean slide designs — one per block type.
 * Each type has a distinct visual treatment while sharing the same
 * off-white / dark-text palette.
 */

import { motion } from 'framer-motion'

const contentVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
}

export default function StoryBlock({ block, index, total }) {
  const { type, content = {}, style_hints = {} } = block

  // Accent colour from style_hints — fallback to a neutral charcoal
  const accent = style_hints.accentColor || '#3b82f6'

  const renderers = {
    headline:    <HeadlineBlock    content={content} accent={accent} />,
    sub_headline: <SubHeadlineBlock content={content} accent={accent} />,
    proof_point:  <ProofPointBlock  content={content} accent={accent} />,
    visual:       <VisualBlock      content={content} accent={accent} />,
    cta:          <CTABlock         content={content} accent={accent} />,
  }

  return (
    <div
      className="w-full h-full flex flex-col"
      role="article"
      aria-label={`Slide ${index + 1} of ${total}: ${type}`}
    >
      {renderers[type] ?? <FallbackBlock content={content} />}

      {/* Slide counter — bottom left, subtle */}
      <div
        className="absolute bottom-5 left-5 text-[11px] font-medium tracking-widest
                   text-black/25 tabular-nums pointer-events-none select-none z-10"
        aria-hidden="true"
      >
        {index + 1}/{total}
      </div>
    </div>
  )
}

// ── Headline ──────────────────────────────────────────────────────────────────
// Full white slide, huge centred title. Accent bar up top.

function HeadlineBlock({ content, accent }) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full bg-white px-8 text-center overflow-hidden">

      {/* Top accent stripe */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: accent }}
      />

      {/* Decorative large circle — background texture */}
      <div
        className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-[0.04]"
        style={{ backgroundColor: accent }}
      />

      <motion.div
        key="headline-content"
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-xs"
      >
        {content.eyebrow && (
          <p
            className="text-xs font-bold uppercase tracking-[0.18em] mb-5"
            style={{ color: accent }}
          >
            {content.eyebrow}
          </p>
        )}

        <h1 className="text-[2.6rem] leading-[1.1] font-extrabold text-gray-950 tracking-tight">
          {content.text || 'Untitled'}
        </h1>

        {content.subtitle && (
          <p className="mt-4 text-base text-gray-500 leading-relaxed font-normal">
            {content.subtitle}
          </p>
        )}
      </motion.div>

      {/* Bottom accent mark */}
      <div
        className="absolute bottom-0 left-8 right-8 h-px opacity-20"
        style={{ backgroundColor: accent }}
      />
    </div>
  )
}

// ── Sub-headline ──────────────────────────────────────────────────────────────
// Off-white slide, left-aligned, vertical accent bar, clean bullets.

function SubHeadlineBlock({ content, accent }) {
  return (
    <div className="relative flex flex-col justify-center h-full bg-[#f7f7f5] px-8 overflow-hidden">

      {/* Subtle background texture — large circle top-right */}
      <div
        className="absolute -top-32 -right-32 w-72 h-72 rounded-full opacity-[0.06]"
        style={{ backgroundColor: accent }}
      />

      <motion.div
        key="sub-content"
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-sm"
      >
        {/* Left vertical accent bar */}
        <div
          className="absolute -left-5 top-0 bottom-0 w-[3px] rounded-full opacity-70"
          style={{ backgroundColor: accent }}
        />

        <h2 className="text-2xl font-bold text-gray-900 leading-snug mb-5">
          {content.text}
        </h2>

        {content.bullets?.length > 0 && (
          <ul className="flex flex-col gap-3.5">
            {content.bullets.map((bullet, i) => (
              <motion.li
                key={i}
                className="flex gap-3 items-start text-gray-700 text-[0.95rem] leading-snug"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
              >
                <span
                  className="mt-[5px] flex-shrink-0 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                {bullet}
              </motion.li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  )
}

// ── Proof Point ───────────────────────────────────────────────────────────────
// White slide, large coloured stat, supporting text, subtle source.

function ProofPointBlock({ content, accent }) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full bg-white px-8 text-center overflow-hidden">

      {/* Background number shadow */}
      {content.stat && (
        <div
          className="absolute text-[12rem] font-black opacity-[0.035] leading-none pointer-events-none select-none"
          style={{ color: accent }}
          aria-hidden="true"
        >
          {content.stat}
        </div>
      )}

      <motion.div
        key="proof-content"
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-xs"
      >
        {content.stat && (
          <div
            className="text-[4.5rem] font-black leading-none tracking-tighter mb-3"
            style={{ color: accent }}
          >
            {content.stat}
          </div>
        )}

        {content.text && (
          <p className="text-xl font-semibold text-gray-800 leading-snug mb-4">
            {content.text}
          </p>
        )}

        {content.source && (
          <p className="text-xs text-gray-400 font-medium tracking-wide">
            — {content.source}
          </p>
        )}
      </motion.div>

      {/* Bottom coloured line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }}
      />
    </div>
  )
}

// ── Visual ────────────────────────────────────────────────────────────────────
// Full-bleed image with a clean frosted caption strip at the bottom.

function VisualBlock({ content, accent }) {
  const hasImage = Boolean(content.mediaUrl)

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-gray-100">

      {hasImage ? (
        <>
          {/* Full bleed image */}
          <img
            src={content.mediaUrl}
            alt={content.mediaAlt || ''}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Gradient scrim for caption legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </>
      ) : (
        /* Placeholder if no image */
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${accent}18, ${accent}06)` }}
        >
          <span className="text-6xl opacity-20">🖼</span>
        </div>
      )}

      {/* Caption strip */}
      {content.text && (
        <motion.div
          key="visual-caption"
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          className="absolute bottom-12 left-6 right-6 z-10"
        >
          <p className={`text-lg font-semibold leading-snug ${hasImage ? 'text-white' : 'text-gray-800'}`}>
            {content.text}
          </p>
        </motion.div>
      )}

      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 z-10"
        style={{ backgroundColor: accent }}
      />
    </div>
  )
}

// ── CTA ───────────────────────────────────────────────────────────────────────
// White slide, bold centred message, large pill button.

function CTABlock({ content, accent }) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full bg-white px-8 text-center overflow-hidden">

      {/* Background blobs */}
      <div
        className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full opacity-[0.07] blur-2xl"
        style={{ backgroundColor: accent }}
      />
      <div
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.05] blur-2xl"
        style={{ backgroundColor: accent }}
      />

      <motion.div
        key="cta-content"
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-xs flex flex-col items-center gap-6"
      >
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg"
          style={{ backgroundColor: accent }}
        >
          →
        </div>

        {content.text && (
          <p className="text-2xl font-bold text-gray-900 leading-snug">
            {content.text}
          </p>
        )}

        {content.ctaLabel && content.ctaUrl && (
          <a
            href={content.ctaUrl}
            onClick={(e) => e.stopPropagation()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-full text-white font-bold text-base
                       shadow-lg active:scale-95 transition-transform"
            style={{ backgroundColor: accent }}
          >
            {content.ctaLabel}
          </a>
        )}
      </motion.div>
    </div>
  )
}

// ── Fallback ──────────────────────────────────────────────────────────────────

function FallbackBlock({ content }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#f7f7f5] px-8 text-center">
      <p className="text-lg text-gray-700 font-medium">{content.text || 'Slide'}</p>
    </div>
  )
}
