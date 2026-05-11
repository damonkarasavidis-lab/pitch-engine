/**
 * app/not-found.jsx
 * Rendered when notFound() is called from any page (e.g. unknown deck slug).
 */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-white/30 text-sm font-mono tracking-widest uppercase">404</p>
      <h1 className="text-3xl font-bold text-white">Deck not found</h1>
      <p className="text-white/50 max-w-xs">
        This link may have expired or the deck was deleted.
      </p>
      <a
        href="/"
        className="mt-4 inline-block border border-white/20 hover:border-white/50
                   transition-colors text-white/70 hover:text-white
                   px-6 py-3 rounded-full text-sm font-medium"
      >
        ← Back to home
      </a>
    </main>
  )
}
