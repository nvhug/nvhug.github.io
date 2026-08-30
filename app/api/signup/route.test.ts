import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGenerateLink,
  mockCreateUser,
  mockCreateClient,
  mockSendNotifyEmail,
  mockSeedDashboardPhase,
  mockSeedCopiedContent,
  mockAfter,
} = vi.hoisted(() => ({
  mockGenerateLink: vi.fn(),
  // Present only so a regression that reintroduces it would be visible here.
  mockCreateUser: vi.fn(),
  mockCreateClient: vi.fn(),
  mockSendNotifyEmail: vi.fn(),
  mockSeedDashboardPhase: vi.fn(),
  mockSeedCopiedContent: vi.fn(),
  mockAfter: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

vi.mock('@/lib/seed-account', () => ({
  seedDashboardPhase: mockSeedDashboardPhase,
  seedCopiedContent: mockSeedCopiedContent,
}))

vi.mock('@/lib/notify', () => ({
  sendNotifyEmail: mockSendNotifyEmail,
  buildNotifyEmailHtml: vi.fn((p: { bodyHtml: string }) => `<html>${p.bodyHtml}</html>`),
  escapeHtml: vi.fn((v: string) => v),
}))

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: mockAfter,
}))

import { POST } from './route'

const ACTION_LINK = 'https://project.supabase.co/auth/v1/verify?token=abc&type=signup'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    mockCreateClient.mockReturnValue({
      auth: { admin: { generateLink: mockGenerateLink, createUser: mockCreateUser } },
    })
    mockGenerateLink.mockResolvedValue({
      data: { user: { id: 'user-1' }, properties: { action_link: ACTION_LINK } },
      error: null,
    })
    mockSendNotifyEmail.mockResolvedValue(true)
    mockSeedDashboardPhase.mockResolvedValue(true)
    mockSeedCopiedContent.mockResolvedValue(undefined)
  })

  // The vulnerability itself: an account must never be created pre-confirmed,
  // or an attacker can pre-register a stranger's address and inherit the
  // account when its real owner signs in with the matching OAuth identity.
  it('never creates a pre-confirmed account — uses generateLink, not createUser({ email_confirm })', async () => {
    await POST(makeRequest({ email: 'victim@gmail.com', password: 'pw123456' }))

    expect(mockCreateUser).not.toHaveBeenCalled()
    expect(mockGenerateLink).toHaveBeenCalledTimes(1)
    const args = mockGenerateLink.mock.calls[0][0]
    expect(args.type).toBe('signup')
    expect(args.email).toBe('victim@gmail.com')
    expect(args).not.toHaveProperty('email_confirm')
    expect(args.options).not.toHaveProperty('email_confirm')
    expect(JSON.stringify(args)).not.toContain('email_confirm')
  })

  it('routes the confirmation link back through the existing auth callback', async () => {
    await POST(makeRequest({ email: 'new@example.com', password: 'pw123456' }))

    expect(mockGenerateLink.mock.calls[0][0].options.redirectTo).toBe(
      'http://localhost/api/auth/callback?next=/notes'
    )
  })

  it('emails the action_link and returns ok on a successful signup', async () => {
    const response = await POST(makeRequest({ email: ' new@example.com ', password: 'pw123456' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })

    expect(mockSendNotifyEmail).toHaveBeenCalledTimes(1)
    const [to, subject, html] = mockSendNotifyEmail.mock.calls[0]
    expect(to).toBe('new@example.com')
    expect(subject).toBeTruthy()
    expect(html).toContain(ACTION_LINK)
  })

  it('returns 409 email_exists for a duplicate address', async () => {
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: 'A user with this email address has already been registered' },
    })

    const response = await POST(makeRequest({ email: 'taken@example.com', password: 'pw123456' }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: 'email_exists' })
    expect(mockSendNotifyEmail).not.toHaveBeenCalled()
  })

  it('returns 500 signup_failed for any other generateLink error', async () => {
    mockGenerateLink.mockResolvedValue({ data: null, error: { message: 'database is down' } })

    const response = await POST(makeRequest({ email: 'a@example.com', password: 'pw123456' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'signup_failed' })
  })

  it('returns 500 signup_failed when no action_link comes back', async () => {
    mockGenerateLink.mockResolvedValue({ data: { user: { id: 'user-1' }, properties: {} }, error: null })

    const response = await POST(makeRequest({ email: 'a@example.com', password: 'pw123456' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'signup_failed' })
    expect(mockSendNotifyEmail).not.toHaveBeenCalled()
  })

  it.each([
    ['missing email', { password: 'pw123456' }],
    ['missing password', { email: 'a@example.com' }],
    ['non-string email', { email: 123, password: 'pw123456' }],
    ['non-string password', { email: 'a@example.com', password: null }],
  ])('rejects invalid input (%s) with 400 and never creates an account', async (_label, body) => {
    const response = await POST(makeRequest(body))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'invalid_input' })
    expect(mockGenerateLink).not.toHaveBeenCalled()
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  // The account already exists at this point, so a transient mail outage must
  // not turn into a failed signup.
  it('still succeeds when the confirmation email fails to send', async () => {
    mockSendNotifyEmail.mockResolvedValue(false)

    const response = await POST(makeRequest({ email: 'a@example.com', password: 'pw123456' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mockSeedDashboardPhase).toHaveBeenCalledWith(expect.anything(), 'user-1')
  })

  it('seeds the new account and schedules the copied-content phase after a won claim', async () => {
    await POST(makeRequest({ email: 'a@example.com', password: 'pw123456' }))

    expect(mockSeedDashboardPhase).toHaveBeenCalledTimes(1)
    expect(mockSeedDashboardPhase).toHaveBeenCalledWith(expect.anything(), 'user-1')
    expect(mockAfter).toHaveBeenCalledTimes(1)

    mockAfter.mock.calls[0][0]()
    expect(mockSeedCopiedContent).toHaveBeenCalledWith(expect.anything(), 'user-1')
  })

  it('does not schedule the copied-content phase when the seeding claim is lost', async () => {
    mockSeedDashboardPhase.mockResolvedValue(false)

    const response = await POST(makeRequest({ email: 'a@example.com', password: 'pw123456' }))

    expect(response.status).toBe(200)
    expect(mockAfter).not.toHaveBeenCalled()
    expect(mockSeedCopiedContent).not.toHaveBeenCalled()
  })
})
