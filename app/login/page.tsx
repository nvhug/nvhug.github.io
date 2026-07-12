import { Suspense } from 'react'
import LoginForm from './LoginForm'

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-svh overflow-hidden bg-[radial-gradient(circle_at_12%_16%,rgba(16,185,129,0.18),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(52,211,153,0.2),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] px-4 py-14 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(16,185,129,0.07)_0%,transparent_28%,transparent_72%,rgba(16,185,129,0.08)_100%)]" />
      <div className="relative mx-auto flex min-h-[calc(100svh-7rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-emerald-200/70 bg-white/85 p-6 shadow-[0_35px_70px_-50px_rgba(16,185,129,0.7)] backdrop-blur sm:p-8">
          {children}
        </div>
      </div>
    </main>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-14 w-full rounded-xl border border-emerald-200 bg-emerald-50/60" />
      <div className="h-11 w-full rounded-xl bg-emerald-500/40" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <CardShell>
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
    </CardShell>
  )
}
