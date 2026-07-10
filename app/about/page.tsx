import Link from 'next/link'

export default function AboutPage() {
  return (
    <main className="min-h-svh bg-[#f7fef9] pb-16 pt-24">
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-emerald-200/70 bg-white/85 p-6 shadow-[0_20px_42px_-32px_rgba(16,185,129,0.28)] sm:p-8">
          <Link href="/" className="text-sm font-medium text-zinc-500 transition-colors hover:text-emerald-700">
            ← Back
          </Link>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Profile</p>
          <h1 className="mt-2 font-poppins text-4xl font-semibold leading-tight text-zinc-900">About Me</h1>
          <p className="mt-4 max-w-2xl text-lg leading-snug text-zinc-600">
            I am a remote-first software engineer who values freedom, ownership, and meaningful work.
            With 11+ years of experience, I help teams build reliable products with calm focus and long-term thinking.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-snug text-zinc-600">
            How I can help: build practical web features, improve delivery quality, and move ideas into production with clarity.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-7">
              <h2 className="mb-4 font-poppins text-2xl font-semibold text-zinc-900">Who I Am</h2>
              <p className="mb-3 leading-snug text-zinc-700">
                I have worked at one company since 2015, growing from implementation to end-to-end ownership.
                I am an introverted engineer who prefers depth over noise and values disciplined execution.
              </p>
              <p className="leading-snug text-zinc-700">
                I build with responsibility, choose pragmatic solutions, and care deeply about maintainable
                systems. This blog captures lessons from real projects and daily engineering decisions.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
              <h2 className="mb-4 font-poppins text-2xl font-semibold text-zinc-900">Professional Focus</h2>
              <p className="mb-4 leading-snug text-zinc-600">How I usually create impact in product teams:</p>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-emerald-500">•</span>
                  <span className="leading-snug text-zinc-600"><strong className="text-zinc-900">Problem Framing</strong> - Clarify requirements early and turn unclear ideas into practical implementation plans</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-500">•</span>
                  <span className="leading-snug text-zinc-600"><strong className="text-zinc-900">Delivery Discipline</strong> - Keep momentum with clear scope, consistent execution, and dependable timelines</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-500">•</span>
                  <span className="leading-snug text-zinc-600"><strong className="text-zinc-900">Engineering Quality</strong> - Prioritize maintainability, readability, and long-term system stability</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-500">•</span>
                  <span className="leading-snug text-zinc-600"><strong className="text-zinc-900">Continuous Improvement</strong> - Learn fast, adapt to new tools, and improve team workflows over time</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
              <h2 className="mb-4 font-poppins text-2xl font-semibold text-zinc-900">Beyond Code</h2>
              <p className="mb-4 leading-snug text-zinc-600">Outside work, I stay grounded through:</p>
              <div className="space-y-2 leading-snug text-zinc-600">
                <p>Football - energy, rhythm, and resilience.</p>
                <p>Learning - new tools, new ideas, better judgment.</p>
                <p>Deep work - fewer words, better outcomes.</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-100 bg-white p-6">
              <h3 className="mb-4 font-poppins text-xl font-semibold text-zinc-900">Skills</h3>
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-sm font-medium text-zinc-900">Core Engineering Stack</p>
                  <p className="text-sm leading-snug text-zinc-600">NestJS, React.js</p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-zinc-900">Additional Languages</p>
                  <p className="text-sm leading-snug text-zinc-600">PHP, Ruby, Python, Node.js</p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-zinc-900">Tooling and Platform</p>
                  <p className="text-sm leading-snug text-zinc-600">VS Code, Git, Docker (foundational), Next.js, Supabase, Vercel</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-6">
              <h3 className="mb-4 font-poppins text-xl font-semibold text-zinc-900">Stats</h3>
              <div className="space-y-3 text-sm text-zinc-700">
                <div className="flex items-center justify-between">
                  <span>Started</span>
                  <span className="font-semibold text-zinc-900">2015</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Experience</span>
                  <span className="font-semibold text-zinc-900">11+ years</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Company</span>
                  <span className="font-semibold text-zinc-900">1 company so far</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <h3 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">Interested in my work?</h3>
              <p className="mb-4 text-sm leading-snug text-zinc-600">Open to thoughtful collaboration and product-focused engineering work.</p>
              <Link
                href="mailto:nvhug001@gmail.com"
                className="inline-flex w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:from-emerald-400 hover:to-emerald-500"
              >
                Send Email
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-8">
          <h2 className="mb-4 font-poppins text-3xl font-semibold text-zinc-900">Interested in my work?</h2>
          <p className="mb-8 max-w-2xl leading-snug text-zinc-600">
            I write about practical engineering, clean delivery, and sustainable product thinking.
            If that resonates, let us connect.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:from-emerald-400 hover:to-emerald-500"
            >
              Read Articles →
            </Link>
            <Link
              href="mailto:nvhug001@gmail.com"
              className="inline-flex items-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-emerald-50"
            >
              Contact Me
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
