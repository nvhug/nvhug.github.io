'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useLanguage } from '@/lib/i18n/language-context'
import { JigsawSliderCaptcha } from '@/components/JigsawSliderCaptcha'

// ── Icons ────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#1877F2" d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  )
}

// ── Step 2: OAuth buttons ─────────────────────────────────────

function OAuthStep({ redirect, onSignup, onEmailLogin, onForgot }: { redirect: string; onSignup: () => void; onEmailLogin: () => void; onForgot: () => void }) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState<'google' | 'facebook' | null>(null)
  const [error, setError] = useState('')

  async function signInWith(provider: 'google' | 'facebook') {
    setLoading(provider)
    setError('')
    const supabase = getSupabaseBrowserClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirect)}`,
      },
    })
    if (oauthError) {
      setError(t('login.oauthError'))
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-poppins text-xl font-semibold text-zinc-900">{t('login.oauthHeading')}</h2>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => signInWith('google')}
          disabled={loading !== null}
          className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          {loading === 'google' ? t('login.redirecting') : t('login.continueWithGoogle')}
        </button>

        <button
          type="button"
          onClick={() => signInWith('facebook')}
          disabled={loading !== null}
          className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FacebookIcon />
          {loading === 'facebook' ? t('login.redirecting') : t('login.continueWithFacebook')}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-400">{t('login.or')}</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <button
        type="button"
        onClick={onEmailLogin}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
      >
        {t('login.continueWithEmail')}
      </button>

      <div className="border-t border-zinc-100 pt-2 space-y-1.5 text-center text-sm text-zinc-500">
        <div>
          Chưa có tài khoản?{' '}
          <button
            type="button"
            onClick={onSignup}
            className="font-medium text-emerald-600 hover:underline"
          >
            {t('signup.registerLink')}
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={onForgot}
            className="text-sm text-emerald-600 hover:underline"
          >
            {t('forgotPassword.link')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 1: PIN form ──────────────────────────────────────────

function PinStep({ redirect, onSuccess }: { redirect: string; onSuccess: () => void }) {
  const { t } = useLanguage()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const lastAttemptedRef = useRef('')
  const inFlightRef = useRef(false)

  const loginWithPin = useCallback(async (pinValue: string, silentError = false) => {
    const normalized = pinValue.trim()
    if (!normalized || inFlightRef.current) return false

    inFlightRef.current = true
    setLoading(true)

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: normalized }),
    })

    if (res.ok) {
      onSuccess()
      return true
    }

    inFlightRef.current = false
    setLoading(false)
    if (!silentError) setError(t('login.pinError'))
    return false
  }, [onSuccess])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    lastAttemptedRef.current = pin.trim()
    await loginWithPin(pin)
  }

  useEffect(() => {
    const normalized = pin.trim()
    if (normalized.length !== 4 || normalized === lastAttemptedRef.current) return
    const timer = window.setTimeout(async () => {
      lastAttemptedRef.current = normalized
      await loginWithPin(normalized, true)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [pin, loginWithPin])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-poppins text-2xl font-semibold text-zinc-900">{t('login.pinHeading')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('login.pinStep')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="• • • •"
          value={pin}
          onChange={(e) => { setError(''); setPin(e.target.value) }}
          className="h-14 w-full rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 text-center font-semibold tracking-[0.65em] text-zinc-900 outline-none transition-colors placeholder:tracking-[0.2em] placeholder:text-zinc-400 focus-visible:border-emerald-500 focus-visible:bg-white"
        />

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!pin.trim() || loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {loading ? t('login.checking') : t('login.continue')}
        </button>
      </form>
    </div>
  )
}

// ── Step 3: Email/password login ─────────────────────────────

function EmailLoginStep({ redirect, onBack, onSignup, onForgot }: { redirect: string; onBack: () => void; onSignup: () => void; onForgot: () => void }) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = getSupabaseBrowserClient()
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (loginError) {
      setError(t('emailLogin.error'))
      return
    }
    window.location.href = redirect
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-poppins text-xl font-semibold text-zinc-900">{t('emailLogin.heading')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => { setError(''); setEmail(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder={t('emailLogin.passwordPlaceholder')}
          value={password}
          onChange={(e) => { setError(''); setPassword(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />

        <div className="flex justify-end">
          <button type="button" onClick={onForgot} className="text-sm text-emerald-600 hover:underline">
            {t('forgotPassword.link')}
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {loading ? t('emailLogin.loading') : t('emailLogin.submit')}
        </button>
      </form>

      <div className="border-t border-zinc-100 pt-4 space-y-2 text-center text-sm text-zinc-500">
        <div>
          <button type="button" onClick={onBack} className="font-medium text-zinc-600 hover:underline">
            ← {t('emailLogin.backToOAuth')}
          </button>
        </div>
        <div>
          Chưa có tài khoản?{' '}
          <button type="button" onClick={onSignup} className="font-medium text-emerald-600 hover:underline">
            {t('signup.registerLink')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Email/password signup ────────────────────────────

function SignupStep({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [captchaVerified, setCaptchaVerified] = useState(false)
  const [captchaKey, setCaptchaKey] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('signup.errorEmail'))
      return
    }
    if (password.length < 6) {
      setError(t('signup.errorPassword'))
      return
    }
    if (password !== confirm) {
      setError(t('signup.errorConfirm'))
      return
    }
    if (!captchaVerified) {
      setError(t('signup.errorCaptcha'))
      return
    }

    setLoading(true)
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    })
    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      if (body.error === 'email_exists') {
        setError(t('signup.errorExists'))
      } else {
        setError(t('signup.errorGeneral'))
      }
      setCaptchaVerified(false)
      setCaptchaKey(k => k + 1)
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-zinc-700">{t('signup.success')}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-emerald-500"
        >
          {t('signup.backToLogin')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-poppins text-xl font-semibold text-zinc-900">{t('signup.heading')}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => { setError(''); setEmail(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Mật khẩu (tối thiểu 6 ký tự)"
          value={password}
          onChange={(e) => { setError(''); setPassword(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          value={confirm}
          onChange={(e) => { setError(''); setConfirm(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />

        <div className="flex justify-center pt-1">
          <JigsawSliderCaptcha
            key={captchaKey}
            onVerify={() => setCaptchaVerified(true)}
            label={t('bugReport.captchaLabel')}
            verifiedLabel={t('bugReport.captchaVerifiedLabel')}
            refreshLabel={t('bugReport.captchaRefreshLabel')}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {loading ? t('signup.loading') : t('signup.submit')}
        </button>
      </form>

      <div className="border-t border-zinc-100 pt-4 text-center text-sm text-zinc-500">
        Đã có tài khoản?{' '}
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-emerald-600 hover:underline"
        >
          {t('signup.backToLogin')}
        </button>
      </div>
    </div>
  )
}

// ── Step 5: Forgot password ───────────────────────────────────

function ForgotPasswordStep({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('signup.errorEmail'))
      return
    }
    setLoading(true)
    const supabase = getSupabaseBrowserClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (resetError) {
      setError(t('forgotPassword.error'))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-zinc-900">{t('forgotPassword.success')}</p>
          <p className="mt-1 text-sm text-zinc-500">{email}</p>
        </div>
        <button type="button" onClick={onBack} className="text-sm font-medium text-emerald-600 hover:underline">
          ← {t('forgotPassword.backToLogin')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-poppins text-xl font-semibold text-zinc-900">{t('forgotPassword.heading')}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t('forgotPassword.description')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => { setError(''); setEmail(e.target.value) }}
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-emerald-500"
        />

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {loading ? t('forgotPassword.loading') : t('forgotPassword.submit')}
        </button>
      </form>

      <div className="text-center">
        <button type="button" onClick={onBack} className="text-sm font-medium text-zinc-500 hover:underline">
          ← {t('forgotPassword.backToLogin')}
        </button>
      </div>
    </div>
  )
}

// ── Root component ────────────────────────────────────────────

export default function LoginForm() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [step, setStep] = useState<'oauth' | 'email' | 'signup' | 'forgot'>('oauth')
  const [signupKey, setSignupKey] = useState(0)

  const goSignup = () => { setSignupKey(k => k + 1); setStep('signup') }
  const goOAuth = () => setStep('oauth')
  const goEmail = () => setStep('email')

  if (step === 'email') {
    return <EmailLoginStep redirect={redirect} onBack={goOAuth} onSignup={goSignup} onForgot={() => setStep('forgot')} />
  }
  if (step === 'signup') {
    return <SignupStep key={signupKey} onBack={goOAuth} />
  }
  if (step === 'forgot') {
    return <ForgotPasswordStep onBack={goEmail} />
  }

  return <OAuthStep redirect={redirect} onSignup={goSignup} onEmailLogin={goEmail} onForgot={() => setStep('forgot')} />
}
