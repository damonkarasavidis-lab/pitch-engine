/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Fluid typography helpers (used alongside CSS clamp() in mobileViewport.css)
      fontSize: {
        'story-headline':    ['clamp(2rem, 8.5vw, 3.25rem)',  { lineHeight: '1.1',  fontWeight: '800' }],
        'story-subheadline': ['clamp(1.25rem, 5.5vw, 1.875rem)', { lineHeight: '1.25', fontWeight: '700' }],
        'story-body':        ['clamp(0.9375rem, 4vw, 1.125rem)', { lineHeight: '1.45' }],
        'story-stat':        ['clamp(3.5rem, 15vw, 6rem)',    { lineHeight: '1',    fontWeight: '900' }],
      },

      // Colour palette for the engine chrome (slides control their own colours via style_hints)
      colors: {
        engine: {
          bg:      '#0f0f0f',
          surface: '#1a1a1a',
          border:  '#2a2a2a',
          muted:   'rgba(255,255,255,0.35)',
          accent:  '#6366f1',
        },
      },

      // Standard mobile safe-zone spacing (mirrors CSS env() variables)
      spacing: {
        'safe-t': 'env(safe-area-inset-top,    0px)',
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
        'safe-l': 'env(safe-area-inset-left,   0px)',
        'safe-r': 'env(safe-area-inset-right,  0px)',
      },

      // dvh / svh viewport height utilities
      height: {
        'dvh': '100dvh',
        'svh': '100svh',
      },

      minHeight: {
        'dvh': '100dvh',
        'svh': '100svh',
      },

      // Backdrop blur presets for nav chevrons and overlays
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
