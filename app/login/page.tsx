'use client'

import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const searchParams = useSearchParams()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const lastAttemptedPinRef = useRef('')
  const inFlightRef = useRef(false)

  const loginWithPin = useCallback(async (pinValue: string, silentError = false) => {
    const normalizedPin = pinValue.trim()
    if (!normalizedPin || inFlightRef.current) return false

    inFlightRef.current = true
    setLoading(true)

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: normalizedPin }),
    })

    if (res.ok) {
      window.location.href = searchParams.get('redirect') || '/'
      return true
    }

    inFlightRef.current = false
    setLoading(false)
    if (!silentError) {
      setError('Sai mã PIN')
    }
    return false
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    lastAttemptedPinRef.current = pin.trim()
    await loginWithPin(pin)
  }

  useEffect(() => {
    const normalizedPin = pin.trim()
    if (normalizedPin.length !== 4 || normalizedPin === lastAttemptedPinRef.current) return

    const timer = window.setTimeout(async () => {
      lastAttemptedPinRef.current = normalizedPin
      await loginWithPin(normalizedPin, true)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [pin, loginWithPin])

  return (
    <main className="relative min-h-svh overflow-hidden bg-[radial-gradient(circle_at_12%_16%,rgba(16,185,129,0.18),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(52,211,153,0.2),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f7fef9_100%)] px-4 py-14 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(16,185,129,0.07)_0%,transparent_28%,transparent_72%,rgba(16,185,129,0.08)_100%)]" />

      <div className="relative mx-auto flex min-h-[calc(100svh-7rem)] max-w-5xl items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-emerald-200/70 bg-white/85 p-6 shadow-[0_35px_70px_-50px_rgba(16,185,129,0.7)] backdrop-blur sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                autoFocus
                value={pin}
                onChange={(e) => {
                  setError('')
                  setPin(e.target.value)
                }}
                className="h-14 w-full rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 text-center font-semibold tracking-[0.65em] text-zinc-900 outline-none transition-colors placeholder:tracking-[0.2em] placeholder:text-zinc-400 focus-visible:border-emerald-500"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={!pin.trim() || loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
