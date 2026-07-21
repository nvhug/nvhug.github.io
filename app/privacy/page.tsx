import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Note Viet',
  description: 'Privacy policy for Note Viet — how we handle your data.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-svh bg-[#f7fef9] pb-16 pt-24">
      <section className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="rounded-3xl border border-emerald-200/70 bg-white/85 p-6 shadow-[0_20px_42px_-32px_rgba(16,185,129,0.28)] sm:p-8">
          <Link href="/" className="text-sm font-medium text-zinc-500 transition-colors hover:text-emerald-700">
            ← Back
          </Link>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Legal</p>
          <h1 className="mt-2 font-poppins text-4xl font-semibold leading-tight text-zinc-900">Privacy Policy</h1>
          <p className="mt-3 text-sm text-zinc-500">Last updated: July 21, 2026</p>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">Overview</h2>
            <p className="leading-relaxed text-zinc-600">
              Note Viet (<strong>noteviet.vercel.app</strong>) is a personal blog and notes platform. This policy explains
              what data is collected when you log in with Facebook or Google, how it is used, and how you can request deletion.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">Data We Collect</h2>
            <p className="mb-3 leading-relaxed text-zinc-600">
              When you sign in with Facebook or Google, we receive only the basic profile information granted by that provider:
            </p>
            <ul className="space-y-2">
              {['Your name', 'Your email address', 'Your profile picture URL'].map((item) => (
                <li key={item} className="flex gap-3 text-zinc-600">
                  <span className="text-emerald-500">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 leading-relaxed text-zinc-600">
              We do not access your friends list, posts, messages, or any other Facebook data.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">How We Use Your Data</h2>
            <p className="leading-relaxed text-zinc-600">
              Your data is used solely for authentication — to identify you when you log in and to personalise
              your experience on this site. We do not sell, share, or use your data for advertising.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">Data Storage</h2>
            <p className="leading-relaxed text-zinc-600">
              Your profile information is stored securely in <strong>Supabase</strong> (supabase.com), hosted on
              AWS infrastructure. Data is retained as long as your account is active.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">Data Deletion</h2>
            <p className="mb-3 leading-relaxed text-zinc-600">
              You can request deletion of your account data at any time by emailing:
            </p>
            <a
              href="mailto:nvhug001@gmail.com"
              className="font-medium text-emerald-700 hover:underline"
            >
              nvhug001@gmail.com
            </a>
            <p className="mt-3 leading-relaxed text-zinc-600">
              We will permanently delete your name, email, and profile picture from our database within 7 days.
              You can also revoke access directly in your{' '}
              <a
                href="https://www.facebook.com/settings?tab=applications"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-700 hover:underline"
              >
                Facebook App Settings
              </a>.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-6 sm:p-7">
            <h2 className="mb-3 font-poppins text-xl font-semibold text-zinc-900">Contact</h2>
            <p className="leading-relaxed text-zinc-600">
              Questions about this policy? Email{' '}
              <a href="mailto:nvhug001@gmail.com" className="font-medium text-emerald-700 hover:underline">
                nvhug001@gmail.com
              </a>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
