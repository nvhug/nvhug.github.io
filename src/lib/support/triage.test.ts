import { describe, expect, it } from 'vitest'
import {
  AI_CONFIDENCE_THRESHOLD,
  clampPriority,
  requiresHuman,
  decideTriage,
  forceEscalation,
  parseTriageResponse,
} from './triage'
import type { TriageResponse } from './types'

describe('forceEscalation', () => {
  // Spec §7 case 3: a double-charge complaint.
  it('fires on a double-charge complaint in English', () => {
    expect(forceEscalation('I was charged twice for this, please refund me')).toBe('payment')
  })

  it('fires on a double-charge complaint in Vietnamese with diacritics', () => {
    expect(forceEscalation('Tôi bị trừ tiền hai lần, xin hoàn lại tiền')).toBe('payment')
  })

  it('fires on a double-charge complaint in Vietnamese without diacritics', () => {
    expect(forceEscalation('toi bi tru tien hai lan, xin hoan lai tien')).toBe('payment')
  })

  // Spec §7 case 4: an explicit request to talk to a human.
  it('fires on a request for a human in English', () => {
    expect(forceEscalation('Can I talk to a human please, I need a real person')).toBe(
      'human_requested',
    )
  })

  it('fires on a request for a human in Vietnamese with diacritics', () => {
    expect(forceEscalation('Cho tôi gặp người thật được không')).toBe('human_requested')
  })

  it('fires on a request for a human in Vietnamese without diacritics', () => {
    expect(forceEscalation('cho toi gap nguoi that duoc khong')).toBe('human_requested')
  })

  // Spec §7 cases 1 and 2: ordinary product questions must NOT force-escalate.
  it('does not fire on an ordinary "what is this app" question (case 1)', () => {
    expect(forceEscalation('What is this app about?')).toBeNull()
    expect(forceEscalation('Đây là ứng dụng gì vậy?')).toBeNull()
  })

  it('does not fire on an ordinary how-do-I question covered by the KB (case 2)', () => {
    expect(forceEscalation('How do I add a new note?')).toBeNull()
    expect(forceEscalation('Làm sao để thêm ghi chú mới?')).toBeNull()
  })

  it('does not fire on a routine password-reset question', () => {
    expect(forceEscalation('How do I reset my password?')).toBeNull()
    expect(forceEscalation('Làm sao để đặt lại mật khẩu?')).toBeNull()
  })

  it('does not fire on an ordinary finance-tracking question mentioning transfers', () => {
    expect(
      forceEscalation('How do I convert between assets in the finance page?'),
    ).toBeNull()
  })

  it('fires "account" on being locked out, not on a normal password reset', () => {
    expect(forceEscalation('I am locked out of my account')).toBe('account')
    expect(forceEscalation('Tài khoản bị khóa rồi')).toBe('account')
  })

  it('fires "security" on a hacked/compromised account', () => {
    expect(forceEscalation('My account was hacked')).toBe('security')
    expect(forceEscalation('tai khoan cua toi bi hack')).toBe('security')
  })

  it('fires "data_loss" on lost or deleted data', () => {
    expect(forceEscalation('All my notes disappeared, I lost my data')).toBe('data_loss')
    expect(forceEscalation('Dữ liệu bị mất hết rồi')).toBe('data_loss')
  })

  it('returns null for empty or whitespace-only text', () => {
    expect(forceEscalation('')).toBeNull()
    expect(forceEscalation('   ')).toBeNull()
  })
})

describe('parseTriageResponse', () => {
  it('parses a plain JSON ANSWER', () => {
    const result = parseTriageResponse(
      '{"action":"ANSWER","confidence":0.9,"reason":null,"answer":"Go to the notes tab."}',
    )
    expect(result).toEqual({
      action: 'ANSWER',
      confidence: 0.9,
      reason: null,
      answer: 'Go to the notes tab.',
      priority: undefined,
    })
  })

  it('parses JSON wrapped in a ```json fence', () => {
    const raw = '```json\n{"action":"ESCALATE","confidence":0.4,"reason":"unsure","answer":null}\n```'
    expect(parseTriageResponse(raw)).toEqual({
      action: 'ESCALATE',
      confidence: 0.4,
      reason: 'unsure',
      answer: null,
      priority: undefined,
    })
  })

  it('parses JSON with prose before and after it', () => {
    const raw = 'Sure, here is my answer:\n{"action":"ANSWER","confidence":0.95,"reason":null,"answer":"Yes."}\nHope that helps!'
    const result = parseTriageResponse(raw)
    expect(result?.action).toBe('ANSWER')
    expect(result?.answer).toBe('Yes.')
  })

  it('returns null for text that is not JSON at all', () => {
    expect(parseTriageResponse('I think the answer is yes.')).toBeNull()
  })

  it('returns null for malformed JSON, never throws', () => {
    expect(() => parseTriageResponse('{"action": "ANSWER", "confidence": }')).not.toThrow()
    expect(parseTriageResponse('{"action": "ANSWER", "confidence": }')).toBeNull()
  })

  it('returns null for a missing or invalid action', () => {
    expect(parseTriageResponse('{"confidence":0.9,"answer":"x"}')).toBeNull()
    expect(parseTriageResponse('{"action":"MAYBE","confidence":0.9,"answer":"x"}')).toBeNull()
  })

  it('returns null when action is ANSWER and answer is null, empty, or whitespace', () => {
    expect(
      parseTriageResponse('{"action":"ANSWER","confidence":0.9,"reason":null,"answer":null}'),
    ).toBeNull()
    expect(
      parseTriageResponse('{"action":"ANSWER","confidence":0.9,"reason":null,"answer":""}'),
    ).toBeNull()
    expect(
      parseTriageResponse('{"action":"ANSWER","confidence":0.9,"reason":null,"answer":"   "}'),
    ).toBeNull()
  })

  it('allows ESCALATE with a null answer', () => {
    const result = parseTriageResponse(
      '{"action":"ESCALATE","confidence":0.2,"reason":"out of scope","answer":null}',
    )
    expect(result?.action).toBe('ESCALATE')
    expect(result?.answer).toBeNull()
  })

  it('treats a string confidence as invalid', () => {
    expect(
      parseTriageResponse('{"action":"ANSWER","confidence":"0.9","reason":null,"answer":"x"}'),
    ).toBeNull()
  })

  it('treats NaN confidence as invalid', () => {
    // NaN is not valid JSON, so this also exercises the "malformed JSON" path —
    // either way the result must be null, never a thrown error.
    expect(parseTriageResponse('{"action":"ANSWER","confidence":NaN,"answer":"x"}')).toBeNull()
  })

  it('treats an out-of-range confidence (-1) as invalid', () => {
    expect(
      parseTriageResponse('{"action":"ANSWER","confidence":-1,"reason":null,"answer":"x"}'),
    ).toBeNull()
  })

  it('treats an out-of-range confidence (2) as invalid', () => {
    expect(
      parseTriageResponse('{"action":"ANSWER","confidence":2,"reason":null,"answer":"x"}'),
    ).toBeNull()
  })

  it('returns null for a JSON array or a JSON primitive', () => {
    expect(parseTriageResponse('[1,2,3]')).toBeNull()
    expect(parseTriageResponse('42')).toBeNull()
    expect(parseTriageResponse('null')).toBeNull()
  })

  it('carries a valid suggested priority through', () => {
    const result = parseTriageResponse(
      '{"action":"ANSWER","confidence":0.9,"reason":null,"answer":"x","priority":"high"}',
    )
    expect(result?.priority).toBe('high')
  })

  it('ignores an invalid priority value rather than failing the whole parse', () => {
    const result = parseTriageResponse(
      '{"action":"ANSWER","confidence":0.9,"reason":null,"answer":"x","priority":"urgent-ish"}',
    )
    expect(result?.priority).toBeUndefined()
  })
})

describe('decideTriage', () => {
  it('escalates with the forced category regardless of what the model said', () => {
    const parsed: TriageResponse = { action: 'ANSWER', confidence: 0.99, reason: null, answer: 'ignored' }
    const decision = decideTriage({ parsed, forced: 'payment' })
    expect(decision.action).toBe('ESCALATE')
    expect(decision.category).toBe('payment')
    expect(decision.answer).toBeNull()
    expect(decision.priority).toBe('high')
  })

  it('escalates as unparseable when parsing failed', () => {
    const decision = decideTriage({ parsed: null, forced: null })
    expect(decision.action).toBe('ESCALATE')
    expect(decision.category).toBe('unparseable')
    expect(decision.priority).toBe('normal')
  })

  it('escalates as low_confidence exactly below the threshold, at normal priority', () => {
    const parsed: TriageResponse = { action: 'ANSWER', confidence: 0.8499, reason: null, answer: 'x' }
    const decision = decideTriage({ parsed, forced: null })
    expect(decision.action).toBe('ESCALATE')
    expect(decision.category).toBe('low_confidence')
    expect(decision.priority).toBe('normal')
  })

  it('answers exactly at the threshold (0.85)', () => {
    const parsed: TriageResponse = { action: 'ANSWER', confidence: AI_CONFIDENCE_THRESHOLD, reason: null, answer: 'x' }
    const decision = decideTriage({ parsed, forced: null })
    expect(decision.action).toBe('ANSWER')
    expect(decision.answer).toBe('x')
  })

  it('honours action:"ESCALATE" even at high confidence (FR-020)', () => {
    // A model can be entirely confident that a request needs a person. The
    // confidence threshold answers a different question, and forceEscalation's
    // keyword lists cannot enumerate every such request — so the model's own
    // action field has to be obeyed, which is why FR-020 asks for it.
    const parsed: TriageResponse = { action: 'ESCALATE', confidence: 0.9, reason: 'out of scope', answer: null }
    const decision = decideTriage({ parsed, forced: null })
    expect(decision.action).toBe('ESCALATE')
    expect(decision.answer).toBeNull()
    expect(decision.category).toBe('model_escalated')
  })

  it('escalates on action:"ESCALATE" even when the model also supplied an answer', () => {
    // The spec says ESCALATE carries answer:null, but a model that ignores that
    // must not get its text posted to a user who needs a human.
    const parsed: TriageResponse = { action: 'ESCALATE', confidence: 0.95, reason: 'needs a person', answer: 'here is a guess' }
    const decision = decideTriage({ parsed, forced: null })
    expect(decision.action).toBe('ESCALATE')
    expect(decision.answer).toBeNull()
  })

  it('a forced category still wins over the model action', () => {
    const parsed: TriageResponse = { action: 'ANSWER', confidence: 0.99, reason: null, answer: 'x' }
    const decision = decideTriage({ parsed, forced: 'payment' })
    expect(decision.action).toBe('ESCALATE')
    expect(decision.category).toBe('payment')
  })
})

describe('clampPriority', () => {
  it('forces high for any forced escalation category', () => {
    expect(clampPriority(undefined, 'payment')).toBe('high')
    expect(clampPriority('low', 'human_requested')).toBe('high')
  })

  it('defaults to normal when nothing is suggested and nothing is forced', () => {
    expect(clampPriority(undefined, null)).toBe('normal')
  })

  it('passes through low/normal/high suggestions when not forced', () => {
    expect(clampPriority('low', null)).toBe('low')
    expect(clampPriority('normal', null)).toBe('normal')
    expect(clampPriority('high', null)).toBe('high')
  })

  it('refuses urgent from the model, clamping it to high', () => {
    expect(clampPriority('urgent', null)).toBe('high')
  })
})

describe('decideTriage carries the model reason', () => {
  // The reason was parsed and then dropped, so a human picked up an escalated
  // thread with no idea what the assistant had concluded. It is the handover.
  const answered = { action: 'ANSWER' as const, confidence: 0.95, reason: 'covered by KB', answer: 'day la cau tra loi', priority: undefined }
  const escalated = { action: 'ESCALATE' as const, confidence: 0.9, reason: 'user asks about a partner integration', answer: null, priority: undefined }
  const unsure = { action: 'ANSWER' as const, confidence: 0.4, reason: 'not sure the KB covers this', answer: 'co le la...', priority: undefined }

  it('keeps it when the model escalates on its own', () => {
    const d = decideTriage({ parsed: escalated, forced: null })
    expect(d.category).toBe('model_escalated')
    expect(d.reason).toBe('user asks about a partner integration')
  })

  it('keeps it when the confidence threshold escalates instead', () => {
    const d = decideTriage({ parsed: unsure, forced: null })
    expect(d.category).toBe('low_confidence')
    expect(d.reason).toBe('not sure the KB covers this')
  })

  it('keeps it on the answer path too', () => {
    expect(decideTriage({ parsed: answered, forced: null }).reason).toBe('covered by KB')
  })

  it('is null when nothing parseable came back', () => {
    const d = decideTriage({ parsed: null, forced: null })
    expect(d.category).toBe('unparseable')
    expect(d.reason).toBeNull()
  })

  it('is null for a forced escalation, which never called the model', () => {
    const d = decideTriage({ parsed: null, forced: 'payment' })
    expect(d.category).toBe('payment')
    expect(d.reason).toBeNull()
  })

  it('survives a forced escalation that did have a model reply', () => {
    const d = decideTriage({ parsed: escalated, forced: 'security' })
    expect(d.category).toBe('security')
    expect(d.reason).toBe('user asks about a partner integration')
  })
})

describe('requiresHuman', () => {
  it('covers every category forceEscalation can produce', () => {
    // The two lists must not drift: a new keyword category that is not marked
    // human-required would become auto-returnable to the AI an hour later.
    const forced = [
      forceEscalation('I want a refund'),
      forceEscalation('my account is locked'),
      forceEscalation('I have been hacked'),
      forceEscalation('I lost my data'),
      forceEscalation('let me talk to a human'),
    ]
    expect(forced.every((c) => c !== null)).toBe(true)
    for (const category of forced) {
      expect(requiresHuman(category), `${category} must stay with a person`).toBe(true)
    }
  })

  it('lets the AI take back what it simply could not answer this time', () => {
    for (const category of ['low_confidence', 'unparseable', 'provider_failure', 'quota_exhausted', 'model_escalated'] as const) {
      expect(requiresHuman(category), category).toBe(false)
    }
  })

  it('treats an unknown reason as needing a person', () => {
    // An old escalation whose category was never recorded: "we do not know why
    // this was escalated" resolves toward leaving it with the human.
    expect(requiresHuman(null)).toBe(true)
  })
})
