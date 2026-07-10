import { createHmac, timingSafeEqual } from 'crypto'

export const AUTH_COOKIE_NAME = 'site_auth'
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year — log in once per device

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET is not set')
  }
  return secret
}

function computeToken() {
  return createHmac('sha256', getSecret()).update('authenticated').digest('hex')
}

export function isValidPin(pin: string) {
  return pin === process.env.SITE_PIN
}

export function getAuthCookieValue() {
  return computeToken()
}

export function isValidAuthCookie(value: string | undefined) {
  if (!value) return false
  const expected = computeToken()
  const a = Buffer.from(value)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
