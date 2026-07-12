'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function LoginForm() {
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
  )
}
