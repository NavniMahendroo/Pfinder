import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-wrap min-h-screen px-6 py-10 md:px-10">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <p className="text-sm font-semibold tracking-[0.14em] text-slate-700">SMART RESOURCE ALLOCATION</p>
        <Link href="/dashboard" className="rounded-full border border-slate-900/10 bg-white/70 px-5 py-2 text-sm font-semibold text-slate-800 transition hover:bg-white">
          Live Dashboard
        </Link>
      </header>

      <section className="mx-auto mt-12 grid w-full max-w-6xl gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
        <article className="animate-float-up">
          <p className="inline-flex rounded-full border border-amber-200 bg-amber-100/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-900">
            Google Solution Challenge 2026
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-slate-900 md:text-6xl">
            Coordinate Volunteers
            <br />
            Before Crisis Peaks
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-700 md:text-lg">
            AI-ranked matching, real-time heatmaps, and ripple dispatch to connect NGOs and volunteers in minutes.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/auth?role=ngo" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
              NGO Sign In / Sign Up
            </Link>
            <Link href="/auth?role=volunteer" className="rounded-full border border-slate-900/10 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white">
              Volunteer Sign In / Sign Up
            </Link>
          </div>
        </article>

        <aside className="glass animate-float-up rounded-3xl border border-white/70 p-6 shadow-glow" style={{ animationDelay: "160ms" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Live Impact Snapshot</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white/70 p-4">
              <p className="text-sm text-slate-500">Active Distress Tasks</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">124</p>
            </div>
            <div className="rounded-2xl bg-white/70 p-4">
              <p className="text-sm text-slate-500">Volunteers Reachable</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">386</p>
            </div>
            <div className="rounded-2xl bg-white/70 p-4">
              <p className="text-sm text-slate-500">Median Response Time</p>
              <p className="mt-1 text-3xl font-bold text-emerald-700">7.3m</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
