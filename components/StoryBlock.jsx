'use client'

/**
 * StoryBlock.jsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Renders a single full-viewport story slide based on its `type` and `content`.
 * Each block type has a dedicated sub-renderer below.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { motion } from 'framer-motion'

const contentVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
}

export default function StoryBlock({ block, index, total }) {
  const { type, content, style_hints = {} } = block

  const bgStyle = style_hints.bgGradient
    ? { background: style_hints.bgGradient }
    : { backgroundColor: style_hints.bgColor || '#0f0f0f' }

  const textColor = style_hints.textColor || '#ffffff'
  const accent    = style_hints.accentColor || '#6366f1'
  const layout    = style_hints.layout || 'centered'

  const layoutClass = {
    centered: 'items-center justify-center text-center',
    top:      'items-center justify-start text-center pt-24',
    bottom:   'items-center justify-end   text-center pb-24',
    split:    'items-start  justify-center text-left',
  }[layout] || 'items-center justify-center text-center'

  return (
    <div
      className={`story-block ${layoutClass}`}
      style={{ ...bgStyle, color: textColor }}
      role="article"
      aria-label={`Slide ${index + 1} of ${total}: ${type}`}
    >
      {/* Full-bleed background media (for 'visual' type) */}
      {content.mediaUrl && (
        <div className="story-block__media" aria-hidden="true">
          {content.mediaUrl.match(/\.(mp4|webm)$/i) ? (
            <video
              src={content.mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className="story-block__media-el"
            />
          ) : (
            <img
              src={content.mediaUrl}
              alt={content.mediaAlt || ''}
              className="story-block__media-el"
            />
          )}
          {/* Scrim for legibility */}
          <div className="story-block__media-scrim" />
        </div>
      )}

      {/* Content layer */}
      <motion.div
        key={index}
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        className="story-block__content story-safe-zone"
      >
        {type === 'headline'    && <HeadlineBlock    content={content} accent={accent} />}
        {type === 'sub_headline' && <SubHeadlineBlock content={content} accent={accent} />}
        {type === 'visual'      && <VisualBlock       content={content} accent={accent} />}
        {type === 'proof_point' && <ProofPointBlock   content={content} accent={accent} />}
        {type === 'cta'         && <CTABlock          content={content} accent={accent} />}
      </motion.div>

      {/* Slide counter pill (bottom-right) */}
      <div className="story-block__counter" aria-hidden="true">
        {index + 1} / {total}
      </div>
    </div>
  )
}

// ── Sub-renderers ─────────────────────────────────────────────────────────────

function HeadlineBlock({ content, accent }) {
  return (
    <div className="story-block__headline-wrap">
      {content.eyebrow && (
        <p className="story-block__eyebrow" style={{ color: accent }}>
          {content.eyebrow}
        </p>
      )}
      <h1 className="story-block__headline">
        {content.text}
      </h1>
    </div>
  )
}

function SubHeadlineBlock({ content, accent }) {
  return (
    <div className="story-block__subheadline-wrap">
      <h2 className="story-block__subheadline">{content.text}</h2>
      {content.bullets?.length > 0 && (
        <ul className="story-block__bullets">
          {content.bullets.map((b, i) => (
            <li key={i} className="story-block__bullet">
              <span className="story-block__bullet-dot" style={{ color: accent }}>●</span>
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function VisualBlock({ content, accent }) {
  // Visual type — media is rendered in background; text overlaid if present
  return content.text ? (
    <div className="story-block__visual-caption">
      <p>{content.text}</p>
    </div>
  ) : null
}

function ProofPointBlock({ content, accent }) {
  return (
    <div className="story-block__proof-wrap">
      {content.stat && (
        <div className="story-block__stat" style={{ color: accent }}>
          {content.stat}
        </div>
      )}
      {content.text && (
        <p className="story-block__proof-text">{content.text}</p>
      )}
      {content.source && (
        <p className="story-block__source">— {content.source}</p>
      )}
    </div>
  )
}

function CTABlock({ content, accent }) {
  return (
    <div className="story-block__cta-wrap">
      {content.text && (
        <p className="story-block__cta-text">{content.text}</p>
      )}
      {content.ctaLabel && content.ctaUrl && (
        <a
          href={content.ctaUrl}
          className="story-block__cta-btn"
          style={{ backgroundColor: accent }}
          onClick={(e) => e.stopPropagation()}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content.ctaLabel}
        </a>
      )}
    </div>
  )
}
