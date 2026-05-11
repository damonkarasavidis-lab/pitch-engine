/**
 * app/page.jsx — Home / landing page
 * A minimal placeholder that links to the ingest form.
 * We'll replace this with the full ingest UI in Step 6.
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-extrabold text-white tracking-tight">
        Pitch Engine
      </h1>
      <p className="text-white/50 text-lg max-w-sm">
        Turn any content into a mobile-native story deck — shareable via a single link.
      </p>
      <a
        href="/create"
        className="mt-4 inline-block bg-indigo-500 hover:bg-indigo-400 transition-colors
                   text-white font-bold px-8 py-4 rounded-full text-base"
      >
        Create a deck →
      </a>
    </main>
  )
}
