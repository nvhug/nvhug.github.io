import { describe, expect, it } from 'vitest'
import type { HoroscopeProfile } from './horoscope-profile'
import {
  buildInterpretationPrompt,
  lunarDayKey,
  parseInterpretationSections,
  profileFingerprint,
  readCachedInterpretation,
  vietnamTodaySolar,
} from './horoscope-interpretation'
import { buildReading } from './tuvi/reading'

const profile: HoroscopeProfile = {
  birthDateSolar: '1990-06-15',
  birthDateLunar: { day: 23, month: 5, year: 1990, isLeapMonth: false },
  birthTime: '12:30',
  birthTimeUnknown: false,
  gender: 'nam',
  updatedAt: '2026-08-25T00:00:00.000Z',
}

const today = { day: 25, month: 8, year: 2026 }

describe('profileFingerprint', () => {
  it('stays the same when nothing about the birth data changes', () => {
    expect(profileFingerprint(profile)).toBe(profileFingerprint({ ...profile, updatedAt: 'later' }))
  })

  it('changes when the birth date changes', () => {
    expect(profileFingerprint({ ...profile, birthDateSolar: '1991-06-15' })).not.toBe(
      profileFingerprint(profile),
    )
  })

  it('changes when the birth hour changes', () => {
    expect(profileFingerprint({ ...profile, birthTime: '05:30' })).not.toBe(profileFingerprint(profile))
  })

  it('changes when the hour becomes unknown', () => {
    expect(profileFingerprint({ ...profile, birthTimeUnknown: true, birthTime: null })).not.toBe(
      profileFingerprint(profile),
    )
  })

  it('changes when the gender changes', () => {
    expect(profileFingerprint({ ...profile, gender: 'nu' })).not.toBe(profileFingerprint(profile))
  })
})

describe('lunarDayKey', () => {
  it('identifies the lunar day, not the Gregorian one', () => {
    const key = lunarDayKey(today)
    expect(key).toMatch(/^\d{4}-\d{1,2}-\d{1,2}$/)
    expect(key).not.toBe('2026-8-25')
  })

  it('gives two different Gregorian days inside one lunar day the same key only if they are the same lunar day', () => {
    expect(lunarDayKey({ day: 25, month: 8, year: 2026 })).toBe(lunarDayKey({ day: 25, month: 8, year: 2026 }))
    expect(lunarDayKey({ day: 26, month: 8, year: 2026 })).not.toBe(lunarDayKey(today))
  })
})

describe('buildInterpretationPrompt', () => {
  const prompt = buildInterpretationPrompt(buildReading(profile, today), profile)

  it('feeds the computed values into the prompt so the model interprets rather than invents', () => {
    expect(prompt).toContain('Canh Ngọ')
    expect(prompt).toContain('Lộ Bàng Thổ')
    expect(prompt).toContain('Mệnh')
  })

  it('asks for Vietnamese output in a fixed JSON shape', () => {
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('tongQuan')
    expect(prompt).toContain('suNghiep')
    expect(prompt).toContain('taiLoc')
    expect(prompt).toContain('tinhDuyen')
    expect(prompt).toContain('giaDao')
    expect(prompt).toContain('sucKhoe')
  })

  it('never sends anything that identifies the account', () => {
    expect(prompt).not.toContain('@')
    expect(prompt.toLowerCase()).not.toContain('user_id')
    expect(prompt.toLowerCase()).not.toContain('email')
  })

  it('tells the model the birth hour is unknown instead of omitting it silently', () => {
    const noHour = { ...profile, birthTimeUnknown: true, birthTime: null }
    const text = buildInterpretationPrompt(buildReading(noHour, today), noHour)
    expect(text).toContain('không rõ giờ sinh')
  })

  it('feeds each life area its own palace, stars, and arithmetic — not just the final score', () => {
    // This profile's Phúc Đức (gia đạo) carries Tuần, exercising the dampened branch.
    expect(prompt).toContain('Sự nghiệp (Quan Lộc): Liêm Trinh +0, Tả Phù +1, Lộc Tồn +2, Thiên Mã +1, Cô Thần -1 — tổng 3 → 88/100')
    expect(prompt).toContain('Tài lộc (Tài Bạch): Tử Vi +3, Thiên Tướng +2, Quả Tú -1, Phượng Các +1, Văn Xương +1 — tổng 6 → 91/100')
    expect(prompt).toContain('Gia đạo (Phúc Đức): Phá Quân -1, Long Trì +1, Văn Khúc +1 (Tuần) — tổng gốc 1, có Tuần nên chia đôi còn 0.5 → 85/100')
    expect(prompt).toContain(
      'phải giải thích dựa trên đúng các sao và phép tính đã cho ở cung tương ứng',
    )
  })

  it('feeds the three new scored dimensions (tuDuy, hauVan, quyNhan) and the weakest-palace callout', () => {
    expect(prompt).toContain('Tư duy, bản lĩnh (Mệnh):')
    expect(prompt).toContain('Hậu vận (đại vận từ tuổi 60)')
    expect(prompt).toContain('Quý nhân/vận may:')
    expect(prompt).toContain('Điểm cần chú ý (')
  })

  it('asks for a { short, detail } object per section, not a plain string', () => {
    expect(prompt).toContain('"short"')
    expect(prompt).toContain('"detail"')
    expect(prompt).toContain('object có 2 trường "short" và "detail"')
  })

  it('drops the old per-area score summary once the per-area breakdown covers it, keeping only overall', () => {
    expect(prompt).toContain('Điểm tổng quan (thang 0-100): 89.')
    expect(prompt).not.toContain('sự nghiệp 3, tài lộc')
  })
})

const section = (short: string, detail: string) => ({ short, detail })

const fullSections = {
  tongQuan: section('a-short', 'a-detail'),
  tuDuy: section('b-short', 'b-detail'),
  suNghiep: section('c-short', 'c-detail'),
  taiLoc: section('d-short', 'd-detail'),
  tinhDuyen: section('e-short', 'e-detail'),
  giaDao: section('f-short', 'f-detail'),
  sucKhoe: section('g-short', 'g-detail'),
  hauVan: section('h-short', 'h-detail'),
  quyNhan: section('i-short', 'i-detail'),
  vanHan: section('j-short', 'j-detail'),
  diemYeu: section('k-short', 'k-detail'),
}

describe('parseInterpretationSections', () => {
  it('keeps every section when the model returns clean { short, detail } objects', () => {
    expect(parseInterpretationSections(fullSections)).toEqual(fullSections)
  })

  it('accepts a response without the closing vận hạn note', () => {
    const { vanHan: _vanHan, ...withoutVanHan } = fullSections
    expect(parseInterpretationSections(withoutVanHan)).toEqual(withoutVanHan)
  })

  it('rejects a truncated response so a retry actually regenerates it', () => {
    expect(parseInterpretationSections({ tongQuan: fullSections.tongQuan, suNghiep: fullSections.suNghiep })).toBeNull()
  })

  it('rejects a section still in the old plain-string shape, rather than passing it to the UI', () => {
    expect(parseInterpretationSections({ ...fullSections, suNghiep: 'just a string' })).toBeNull()
  })

  it('rejects a section object missing either short or detail', () => {
    expect(parseInterpretationSections({ ...fullSections, suNghiep: { short: 'only short' } })).toBeNull()
    expect(parseInterpretationSections({ ...fullSections, suNghiep: { detail: 'only detail' } })).toBeNull()
  })

  it('ignores keys the UI does not render', () => {
    expect(parseInterpretationSections({ ...fullSections, somethingElse: 'x' })).toEqual(fullSections)
  })

  it('rejects a payload that is not a usable object at all', () => {
    expect(parseInterpretationSections({ suNghiep: 42 })).toBeNull()
    expect(parseInterpretationSections('not an object')).toBeNull()
    expect(parseInterpretationSections(null)).toBeNull()
  })
})

describe('lunarDayKey uniqueness', () => {
  it('never gives two different calendar days the same key, even across a leap month', () => {
    const seen = new Map<string, string>()
    const cursor = new Date(Date.UTC(2025, 0, 1))
    while (cursor.getUTCFullYear() <= 2025) {
      const solar = {
        day: cursor.getUTCDate(),
        month: cursor.getUTCMonth() + 1,
        year: cursor.getUTCFullYear(),
      }
      const key = lunarDayKey(solar)
      const label = `${solar.year}-${solar.month}-${solar.day}`
      expect(seen.get(key), `collision on ${key}`).toBeUndefined()
      seen.set(key, label)
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  })
})

describe('vietnamTodaySolar', () => {
  it('reports the Vietnam date, not the viewer local one', () => {
    // 2026-08-25T18:00Z is already 2026-08-26 in Vietnam (UTC+7).
    expect(vietnamTodaySolar(new Date('2026-08-25T18:00:00Z'))).toEqual({
      day: 26,
      month: 8,
      year: 2026,
    })
  })

  it('keeps the same date earlier in the UTC day', () => {
    expect(vietnamTodaySolar(new Date('2026-08-25T02:00:00Z'))).toEqual({
      day: 25,
      month: 8,
      year: 2026,
    })
  })

  it('rolls the year at the Vietnam boundary', () => {
    expect(vietnamTodaySolar(new Date('2026-12-31T17:30:00Z'))).toEqual({
      day: 1,
      month: 1,
      year: 2027,
    })
  })
})

describe('readCachedInterpretation', () => {
  const fingerprint = 'fp'
  const lunarDay = '2026-7-13'
  const valid = { sections: fullSections, profileFingerprint: fingerprint, lunarDay }

  it('returns the stored sections when the fingerprint and lunar day both match', () => {
    expect(readCachedInterpretation(valid, fingerprint, lunarDay)).toEqual(fullSections)
  })

  it('misses when the birth data changed', () => {
    expect(readCachedInterpretation(valid, 'other', lunarDay)).toBeNull()
  })

  it('misses when the lunar day rolled over', () => {
    expect(readCachedInterpretation(valid, fingerprint, '2026-7-14')).toBeNull()
  })

  it('misses on a malformed record instead of handing junk to the UI', () => {
    expect(readCachedInterpretation(undefined, fingerprint, lunarDay)).toBeNull()
    expect(readCachedInterpretation({ profileFingerprint: fingerprint, lunarDay }, fingerprint, lunarDay)).toBeNull()
    expect(
      readCachedInterpretation(
        { sections: { tongQuan: { nested: 1 } }, profileFingerprint: fingerprint, lunarDay },
        fingerprint,
        lunarDay,
      ),
    ).toBeNull()
    // A record written under the older, looser shape must also read as a miss.
    expect(
      readCachedInterpretation(
        { sections: { tongQuan: 'a' }, profileFingerprint: fingerprint, lunarDay },
        fingerprint,
        lunarDay,
      ),
    ).toBeNull()
  })
})

describe('buildInterpretationPrompt language', () => {
  const reading = buildReading(profile, today)

  it('asks for Vietnamese prose by default', () => {
    expect(buildInterpretationPrompt(reading, profile, 'vi')).toContain('tiếng Việt')
  })

  it('asks for English prose for an English reader, keeping the same JSON keys', () => {
    const prompt = buildInterpretationPrompt(reading, profile, 'en')
    expect(prompt).toContain('English')
    expect(prompt).not.toContain('Viết tiếng Việt')
    expect(prompt).toContain('tongQuan')
    expect(prompt).toContain('sucKhoe')
  })

  it('feeds the same computed values in either language', () => {
    expect(buildInterpretationPrompt(reading, profile, 'en')).toContain('Canh Ngọ')
  })
})
