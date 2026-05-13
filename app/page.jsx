/**
 * app/page.jsx — Home / landing page
 * Hero section using Aceternity UI ContainerScroll animation.
 * Server component — ContainerScroll handles its own "use client" boundary.
 */

import { ContainerScroll } from "@/components/ui/container-scroll-animation";

export default function Home() {
  return (
    /*
      No overflow-x-hidden here — setting overflow-x: hidden on a parent
      can implicitly convert overflow-y to "auto", which clips the page
      scroll that ContainerScroll depends on.
    */
    <main className="min-h-screen bg-[#0f0f0f]">
      <ContainerScroll
        titleComponent={
          <div className="flex flex-col items-center gap-4">
            <span className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              Mobile-first pitching
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-none">
              Pitch Engine
            </h1>
            <p className="text-white/50 text-lg md:text-xl max-w-lg text-center mt-2">
              Turn any content into a mobile-native story deck — shareable via a single link.
            </p>
            <a
              href="/create"
              className="mt-4 inline-block bg-indigo-500 hover:bg-indigo-400 active:scale-95
                         transition-all text-white font-bold px-8 py-4 rounded-full text-base
                         shadow-lg shadow-indigo-500/30"
            >
              Create a deck →
            </a>
          </div>
        }
      >
        {/* Product preview inside the 3D scroll card */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1551650975-87deedd944c3?w=1200&q=80&auto=format&fit=crop"
          alt="Mobile pitch deck preview"
          className="w-full h-full object-cover object-top rounded-xl"
          draggable={false}
        />
      </ContainerScroll>

      {/* Below-fold feature strip */}
      <section className="max-w-4xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        {[
          {
            emoji: "⚡",
            title: "Instant conversion",
            body: "Upload a PPTX, PDF, or DOCX and get a shareable deck in seconds.",
          },
          {
            emoji: "📱",
            title: "Mobile-native",
            body: "Story-style vertical scroll — built for thumbs, not mouse clicks.",
          },
          {
            emoji: "🔗",
            title: "One link to share",
            body: "Send a single URL. Recipients tap through on any device.",
          },
        ].map(({ emoji, title, body }) => (
          <div key={title} className="flex flex-col items-center gap-3">
            <span className="text-4xl">{emoji}</span>
            <h3 className="text-white font-bold text-lg">{title}</h3>
            <p className="text-white/50 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
