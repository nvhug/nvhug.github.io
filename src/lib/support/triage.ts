// Backend-side AI triage rules for "Chat with Us" (spec 014 §5.3). Everything here
// is a pure function: no network calls, no Supabase, no provider calls, and never
// logs prompt/response content (C4, ADR-014). The route calls
// callGeminiWithDeepSeekFallback with a prompt from prompt.ts, then hands the raw
// text and the forced-escalation check to the functions below to get the final,
// backend-validated decision (FR-021..FR-024).

import type { EscalationCategory, Priority, TriageDecision, TriageResponse } from '@/lib/support/types'

/**
 * Below this, an ANSWER is not trusted even if the model was confident about its
 * own confidence. Server-side and final — the model cannot raise, lower, or
 * otherwise influence this value; it only ever supplies the number compared
 * against it (FR-022).
 */
export const AI_CONFIDENCE_THRESHOLD = 0.85

// ─── Forced escalation (FR-023) ─────────────────────────────────────────────
//
// Runs independently of, and before, any model call — a hit here means the
// provider is never even invoked for this message. Matching is substring-based
// against a normalized copy of the text (lowercased, diacritics stripped,
// whitespace collapsed) so "mật khẩu" and "mat khau" hit the same trigger.
// Phrases were chosen to be specific complaints/requests rather than bare nouns
// the product's own knowledge base would otherwise use in an ordinary question —
// see the comment on each list for the false-positive case it was written to avoid.

function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesAny(normalized: string, triggers: readonly string[]): boolean {
  return triggers.some((trigger) => normalized.includes(trigger))
}

// Deliberately not the bare words "payment"/"thanh toan": the finance tab is a
// real, KB-covered feature ("track assets... money in/out, conversions between
// assets"), so a routine question about it must not force-escalate. These are
// complaint/incident phrasings instead.
const PAYMENT_TRIGGERS = [
  'refund', 'billing', 'double charge', 'double-charged', 'double charged', 'charged twice',
  'charged me twice', 'overcharged', 'over charged', 'chargeback', 'payment failed',
  'payment error', 'wrong charge', 'unauthorized charge', 'money transfer', 'wire transfer',
  'tru tien hai lan', 'bi tru tien', 'bi tru 2 lan', 'tru tien 2 lan', 'hoan tien', 'hoan phi',
  'thanh toan loi', 'thanh toan that bai', 'chuyen nham tien', 'chuyen tien nham',
  'gui nham tien', 'bi tru tien oan',
] as const

// Deliberately not "quen mat khau"/"forgot password" or "dat lai mat khau"/"reset
// password" — those are the routine, KB-covered password_reset topic and must
// stay answerable. These target being locked out or denied access, not a normal
// self-service reset.
const ACCOUNT_TRIGGERS = [
  'locked out', 'lockout', 'locked my account', 'account is locked', 'account locked',
  "can't sign in", 'cant sign in', 'cannot sign in', "can't log in", 'cant log in',
  'cannot log in', 'account access', "can't access my account", 'cannot access my account',
  'unable to access my account',
  'khoa tai khoan', 'tai khoan bi khoa', 'khong dang nhap duoc', 'khong the dang nhap',
  'khong vao duoc tai khoan', 'khong truy cap duoc tai khoan', 'mat quyen truy cap tai khoan',
] as const

const SECURITY_TRIGGERS = [
  'hacked', 'been hacked', 'security breach', 'data breach', 'account compromised',
  'password compromised', 'password was compromised', 'unauthorized access',
  'someone accessed my account',
  'bi hack', 'tai khoan bi hack', 'bi tan cong mang', 'mat khau bi lo', 'lo mat khau',
  'ro ri thong tin tai khoan', 'bao mat tai khoan bi',
] as const

const DATA_LOSS_TRIGGERS = [
  'lost my data', 'data loss', 'deleted my data', 'my data disappeared', 'data is gone',
  'all my data is gone', 'my notes disappeared',
  'mat du lieu', 'du lieu bi mat', 'du lieu bien mat', 'bi xoa het du lieu', 'mat het du lieu',
] as const

const HUMAN_REQUESTED_TRIGGERS = [
  'talk to a human', 'speak to a human', 'talk to a real person', 'speak to a real person',
  'real person', 'human agent', 'talk to support', 'speak with someone', 'human support',
  'i want to talk to someone', 'connect me to a human',
  'gap nguoi that', 'noi chuyen voi nguoi that', 'noi chuyen voi admin', 'gap admin',
  'cho toi gap', 'toi muon gap nhan vien', 'noi chuyen voi nhan vien ho tro', 'gap ho tro vien',
] as const

/**
 * Backend-side sensitive-topic rules, run independently of the model (FR-023).
 * Order matters only when a message could plausibly match more than one category;
 * ties are broken payment > security > account > data_loss > human_requested,
 * roughly most-to-least likely to also be the most urgent.
 */
export function forceEscalation(text: string): EscalationCategory | null {
  const normalized = normalizeForMatch(text)
  if (normalized === '') return null

  if (matchesAny(normalized, PAYMENT_TRIGGERS)) return 'payment'
  if (matchesAny(normalized, SECURITY_TRIGGERS)) return 'security'
  if (matchesAny(normalized, ACCOUNT_TRIGGERS)) return 'account'
  if (matchesAny(normalized, DATA_LOSS_TRIGGERS)) return 'data_loss'
  if (matchesAny(normalized, HUMAN_REQUESTED_TRIGGERS)) return 'human_requested'
  return null
}

/**
 * The categories a conversation may never be handed back to the AI from.
 *
 * These are exactly `forceEscalation`'s outputs: a keyword rule fired because a
 * person reported a charge, a lockout, a breach, lost data, or asked for a human
 * outright. Auto-returning one of those to the assistant after a quiet hour
 * would abandon precisely the requests that were escalated because no model
 * should handle them — and it would do so silently, by removing the row from the
 * admin's waiting list.
 *
 * Everything else (`low_confidence`, `unparseable`, `provider_failure`,
 * `quota_exhausted`, `model_escalated`) was escalated because the AI could not
 * answer *this time*, not because a human is required. Those may come back.
 */
export const HUMAN_REQUIRED_CATEGORIES: readonly EscalationCategory[] = [
  'payment',
  'account',
  'security',
  'data_loss',
  'human_requested',
]

/** `null` — an escalation whose category was never recorded — is treated as
 *  requiring a human. The safe reading of "we do not know why this was
 *  escalated" is to leave it with the person it was escalated to. */
export function requiresHuman(category: EscalationCategory | null): boolean {
  return category === null || HUMAN_REQUIRED_CATEGORIES.includes(category)
}

// ─── Response parsing (FR-020, FR-021) ──────────────────────────────────────

const VALID_PRIORITIES: readonly Priority[] = ['low', 'normal', 'high', 'urgent']

/**
 * Recovers a JSON object from whatever the model actually sent: a bare object, one
 * wrapped in a ```json fence, or one with prose before/after it. Never throws —
 * worst case it returns the whole trimmed string, which then simply fails
 * `JSON.parse` in the caller.
 */
function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim()

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1)

  return trimmed
}

/**
 * Defensively parses the model's raw completion into a `TriageResponse`. Returns
 * `null` — never throws — for anything not usable: not JSON, a JSON value that
 * isn't a plain object, a missing/invalid `action`, a `confidence` that isn't a
 * finite number in [0, 1], or an `ANSWER` whose `answer` is null, empty, or
 * whitespace-only. A `null` return is the caller's signal to escalate (FR-021).
 */
export function parseTriageResponse(raw: string): TriageResponse | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null

  let value: unknown
  try {
    value = JSON.parse(extractJsonCandidate(raw))
  } catch {
    return null
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const obj = value as Record<string, unknown>

  if (obj.action !== 'ANSWER' && obj.action !== 'ESCALATE') return null

  const confidence = obj.confidence
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return null
  }

  const reason = typeof obj.reason === 'string' ? obj.reason : null

  let answer: string | null = typeof obj.answer === 'string' ? obj.answer : null
  if (obj.action === 'ANSWER') {
    if (answer === null || answer.trim() === '') return null
  } else if (answer !== null && answer.trim() === '') {
    // ESCALATE with a blank answer is the same as no answer at all.
    answer = null
  }

  const priority =
    typeof obj.priority === 'string' && (VALID_PRIORITIES as readonly string[]).includes(obj.priority)
      ? (obj.priority as Priority)
      : undefined

  return { action: obj.action, confidence, reason, answer, priority }
}

// ─── Final decision (FR-021/022/023/024) ────────────────────────────────────

/**
 * A `forceEscalation` category forces `high`; a model-suggested priority may
 * raise the default at most to `high` — `urgent` is admin-only and is never
 * something the model can produce (FR-024). `forced` here is specifically the
 * output of `forceEscalation`; escalations decided for other reasons (an
 * unparseable response, low confidence) are NOT "forced" in this sense and so
 * fall through to the model-suggested/default case, same as an ANSWER.
 */
export function clampPriority(suggested: Priority | undefined, forced: EscalationCategory | null): Priority {
  if (forced !== null) return 'high'
  if (suggested === undefined) return 'normal'
  return suggested === 'urgent' ? 'high' : suggested
}

/**
 * The backend's final word on one triage attempt. Precedence, most authoritative
 * first: a backend-side forced escalation always wins over the model; an
 * unparseable response always escalates; a confidence below the threshold always
 * escalates; only then does the model's own ANSWER/ESCALATE choice apply.
 */
export function decideTriage({
  parsed,
  forced,
}: {
  parsed: TriageResponse | null
  forced: EscalationCategory | null
}): TriageDecision {
  if (forced !== null) {
    return {
      action: 'ESCALATE',
      answer: null,
      priority: clampPriority(parsed?.priority, forced),
      category: forced,
      confidence: parsed?.confidence ?? 0,
      // A forced escalation usually never called the model at all, so there is
      // nothing to carry; when one did run (the caller may pass both), its note
      // is still the most informative thing a human agent can be handed.
      reason: parsed?.reason ?? null,
    }
  }

  if (parsed === null) {
    return {
      action: 'ESCALATE',
      answer: null,
      priority: clampPriority(undefined, null),
      category: 'unparseable',
      confidence: 0,
      // Nothing was parseable, so there is no reason to pass on either.
      reason: null,
    }
  }

  // The model asked for a human. Honouring this is the whole reason FR-020
  // makes it return a structured `action` at all: the keyword rules in
  // forceEscalation cannot enumerate every request that needs a person, and
  // the confidence threshold answers a different question — a model can be
  // entirely confident that it must not handle something.
  //
  // Checked BEFORE the threshold so an ESCALATE at high confidence is still an
  // escalation, and its category says why rather than mislabelling it
  // `low_confidence`. Without this the fall-through below turned every such
  // reply into an ANSWER: with the spec-mandated `answer: null` that threw
  // downstream and surfaced as a `provider_failure`, and with a stray answer
  // string it posted the model's text to a user who had asked for support.
  if (parsed.action === 'ESCALATE') {
    return {
      action: 'ESCALATE',
      answer: null,
      priority: clampPriority(parsed.priority, null),
      category: 'model_escalated',
      confidence: parsed.confidence,
      reason: parsed.reason,
    }
  }

  if (parsed.confidence < AI_CONFIDENCE_THRESHOLD) {
    return {
      action: 'ESCALATE',
      answer: null,
      priority: clampPriority(parsed.priority, null),
      category: 'low_confidence',
      confidence: parsed.confidence,
      reason: parsed.reason,
    }
  }

  return {
    action: 'ANSWER',
    answer: parsed.answer,
    priority: clampPriority(parsed.priority, null),
    category: null,
    confidence: parsed.confidence,
    // Carried on the ANSWER path too: appendAiMessage files it in the same
    // admin-readable metadata, so an admin reviewing an answered thread can see
    // what the assistant thought it was doing, not only that it was confident.
    reason: parsed.reason,
  }
}
