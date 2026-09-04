// The knowledge base is the only thing the assistant may state about this
// product (prompt.ts rule 1), so an error here is not a typo — it is the
// assistant confidently telling a user something false. These tests guard the
// shape of every entry, and pin the one fact that was already wrong once.

import { describe, it, expect } from 'vitest'
import { PRODUCT_KNOWLEDGE, KNOWLEDGE_TOPICS_NOT_COVERED } from '@/lib/support/knowledge'
import { buildTriagePrompt } from '@/lib/support/prompt'

describe('PRODUCT_KNOWLEDGE shape', () => {
  it('gives every entry both languages, non-empty', () => {
    for (const entry of PRODUCT_KNOWLEDGE) {
      expect(entry.vi.trim(), `vi for ${entry.topic}`).not.toBe('')
      expect(entry.en.trim(), `en for ${entry.topic}`).not.toBe('')
    }
  })

  it('keeps topic keys unique', () => {
    const topics = PRODUCT_KNOWLEDGE.map((e) => e.topic)
    expect(new Set(topics).size).toBe(topics.length)
  })

  it('never states a price, a paid plan or an upgrade benefit (ADR-017)', () => {
    // The two entries that discuss money do so to DENY that anything is sold,
    // so the check is for a currency figure or a plan tier, not the words.
    const money = /\d[\d.,]*\s*(vnd|đ\b|usd|\$)|gói\s+(pro|premium|plus)|premium plan|pro plan/i
    for (const entry of PRODUCT_KNOWLEDGE) {
      expect(money.test(entry.vi), `vi for ${entry.topic}`).toBe(false)
      expect(money.test(entry.en), `en for ${entry.topic}`).toBe(false)
    }
  })
})

describe('blog visibility — the entry that was wrong', () => {
  // It read "không công khai ra ngoài internet" / "not public on the internet"
  // while app/blog/[slug]/data.ts was serving public posts to the anon client.
  // A privacy question answered wrongly, in the reassuring direction.
  const entry = PRODUCT_KNOWLEDGE.find((e) => e.topic === 'blog_visibility')

  it('exists', () => {
    expect(entry).toBeDefined()
  })

  it('does not claim posts can never be public', () => {
    expect(entry!.vi).not.toMatch(/không công khai ra ngoài internet/i)
    expect(entry!.en).not.toMatch(/not public on the internet/i)
  })

  it('says a public post is readable by anyone with the link, in both languages', () => {
    expect(entry!.vi).toMatch(/công khai/)
    expect(entry!.vi).toMatch(/đường dẫn/)
    expect(entry!.en).toMatch(/public/i)
    expect(entry!.en).toMatch(/link/i)
  })

  it('says posts are private by default, so the correction did not overshoot', () => {
    expect(entry!.vi).toMatch(/mặc định là riêng tư/)
    expect(entry!.en).toMatch(/private by default/i)
  })
})

describe('KNOWLEDGE_TOPICS_NOT_COVERED', () => {
  // Documentation for whoever edits the list, deliberately not wired into the
  // prompt — see the comment on the constant. This test states that intent so
  // the constant's presence in the bundle is not mistaken for a missing wiring.
  it('is a plain list of short labels', () => {
    expect(KNOWLEDGE_TOPICS_NOT_COVERED.length).toBeGreaterThan(0)
    for (const topic of KNOWLEDGE_TOPICS_NOT_COVERED) {
      expect(topic).toMatch(/^[a-z_]+$/)
    }
  })

  it('is not fed to the model', () => {
    const prompt = buildTriagePrompt({
      knowledge: PRODUCT_KNOWLEDGE,
      history: [],
      message: 'xin chao',
      lang: 'vi',
    })
    for (const topic of KNOWLEDGE_TOPICS_NOT_COVERED) {
      expect(prompt).not.toContain(topic)
    }
  })
})

describe('the knowledge base reaches the prompt', () => {
  it('carries the corrected blog fact into the built prompt, in each language', () => {
    const vi = buildTriagePrompt({ knowledge: PRODUCT_KNOWLEDGE, history: [], message: 'blog?', lang: 'vi' })
    const en = buildTriagePrompt({ knowledge: PRODUCT_KNOWLEDGE, history: [], message: 'blog?', lang: 'en' })
    const entry = PRODUCT_KNOWLEDGE.find((e) => e.topic === 'blog_visibility')!

    expect(vi).toContain(entry.vi)
    expect(en).toContain(entry.en)
    // And each prompt carries only the language it asked for.
    expect(vi).not.toContain(entry.en)
    expect(en).not.toContain(entry.vi)
  })
})
