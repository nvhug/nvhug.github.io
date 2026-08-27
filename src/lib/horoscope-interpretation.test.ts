import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { HoroscopeProfile } from './horoscope-profile'
import {
  buildInterpretationPrompt,
  lunarDayKey,
  lunarMonthKey,
  parseInterpretationSections,
  profileFingerprint,
  INTERPRETATION_VERSION,
  isUnlimitedTuviRole,
  readCachedInterpretation,
  SECTIONS_MAX_TOKENS,
  SECTIONS_TIMEOUT_MS,
  TUVI_DAILY_LIMIT,
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

describe('lunarMonthKey — what a reading stays valid for', () => {
  // The cache and the abuse fuse used to share one key, and it was the day's. Nothing in
  // a reading is computed from the day — buildCycles takes Đại vận and Lưu niên from the
  // lunar year and Lưu nguyệt from the year and month — so keying the cache on the day
  // discarded a good reading every midnight and paid for a fresh one saying the same
  // thing in different words. Roughly thirty completions a month where one would do.
  // Takes a SOLAR date and resolves it to a lunar month, so a run of solar days can
  // straddle a lunar boundary — solar 2026-08-01 is still lunar month 6, 2026-08-02 is
  // month 7. These fixtures sit inside one lunar month deliberately.
  // Fixtures computed from the real converter, not guessed: solar 2026-08-01..12 all
  // resolve to lunar month 6, and 2026-08-13 onward to lunar month 7.
  it('is the same for every day inside one lunar month', () => {
    const first = lunarMonthKey({ day: 13, month: 8, year: 2026 })
    for (const day of [14, 20, 25, 31]) {
      expect(lunarMonthKey({ day, month: 8, year: 2026 })).toBe(first)
    }
  })

  it('changes at the lunar boundary, which is when Lưu nguyệt genuinely changes', () => {
    expect(lunarMonthKey({ day: 12, month: 8, year: 2026 })).toBe('2026-6')
    expect(lunarMonthKey({ day: 13, month: 8, year: 2026 })).toBe('2026-7')
  })

  it('is a lunar month, not the Gregorian one it was handed', () => {
    // Solar August 2026 spans two lunar months, so a key that merely echoed its input
    // would pass every other test here and still be wrong.
    expect(lunarMonthKey({ day: 20, month: 8, year: 2026 })).not.toBe('2026-8')
  })

  it('changes across years', () => {
    expect(lunarMonthKey({ day: 5, month: 3, year: 2027 })).not.toBe(
      lunarMonthKey({ day: 5, month: 3, year: 2026 })
    )
  })

  it('stays distinct from the daily fuse key, which must keep resetting daily', () => {
    // Conflating them again is the regression this guards. The fuse exists so a
    // birth-hour edit loop cannot bill without limit, and it can only do that job if it
    // resets every day.
    const solar = { day: 20, month: 8, year: 2026 }
    expect(lunarMonthKey(solar)).not.toBe(lunarDayKey(solar))
    expect(lunarDayKey({ ...solar, day: 21 })).not.toBe(lunarDayKey(solar))
    expect(lunarMonthKey({ ...solar, day: 21 })).toBe(lunarMonthKey(solar))
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
  const lunarMonth = '2026-7-13'
  const valid = {
    sections: fullSections,
    profileFingerprint: fingerprint,
    lunarMonth,
    version: INTERPRETATION_VERSION,
  }

  it('returns the stored sections when the fingerprint and lunar day both match', () => {
    expect(readCachedInterpretation(valid, fingerprint, lunarMonth)).toEqual({
      sections: fullSections,
      current: true,
    })
  })

  it('serves a reading from an earlier lunar month, marked not current', () => {
    // Not null. Of the eleven sections exactly one — vanHan — interprets the cycles, and
    // even there only its Lưu nguyệt half ages; the other ten describe the natal chart.
    // Throwing all eleven away to refresh one would be a bad trade, so the caller shows
    // what it has and offers a refresh.
    const lastMonth = { ...valid, lunarMonth: '2026-6' }
    const hit = readCachedInterpretation(lastMonth, fingerprint, '2026-7')
    expect(hit?.sections).toEqual(valid.sections)
    expect(hit?.current).toBe(false)
  })

  it('still refuses a reading belonging to different birth data', () => {
    // The month is soft; the fingerprint is not. A different birth date is a different
    // person's chart and must never be served, however fresh it looks.
    expect(readCachedInterpretation({ ...valid, lunarMonth: '2026-7' }, 'other', '2026-7')).toBeNull()
  })

  it('marks a reading from an older prompt as not current', () => {
    // Returned rather than dropped: the route regenerates it, but falls back to
    // this text if the reader has no generation left today.
    const older = { ...valid, version: INTERPRETATION_VERSION - 1 }
    expect(readCachedInterpretation(older, fingerprint, lunarMonth)?.current).toBe(false)
    // A record predating the version field at all counts the same way.
    const { version: _version, ...unversioned } = valid
    expect(readCachedInterpretation(unversioned, fingerprint, lunarMonth)?.current).toBe(false)
  })

  it('misses when the birth data changed', () => {
    expect(readCachedInterpretation(valid, 'other', lunarMonth)).toBeNull()
  })

  it('never returns a bare miss for a date change — only current: false', () => {
    // Superseded deliberately. This used to assert null on a rolled-over day, which meant
    // a reader lost eleven sections of prose to refresh the one that had actually aged.
    const rolled = readCachedInterpretation(valid, fingerprint, '2026-12')
    expect(rolled).not.toBeNull()
    expect(rolled?.current).toBe(false)
  })

  it('misses on a malformed record instead of handing junk to the UI', () => {
    expect(readCachedInterpretation(undefined, fingerprint, lunarMonth)).toBeNull()
    expect(readCachedInterpretation({ profileFingerprint: fingerprint, lunarMonth }, fingerprint, lunarMonth)).toBeNull()
    expect(
      readCachedInterpretation(
        { sections: { tongQuan: { nested: 1 } }, profileFingerprint: fingerprint, lunarMonth },
        fingerprint,
        lunarMonth,
      ),
    ).toBeNull()
    // A record written under the older, looser shape must also read as a miss.
    expect(
      readCachedInterpretation(
        { sections: { tongQuan: 'a' }, profileFingerprint: fingerprint, lunarMonth },
        fingerprint,
        lunarMonth,
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

describe('sections generation budget', () => {
  // Slowest sustained output rate seen across five real completions on four
  // different charts (2331-3026 output tokens, 18.7-24.8s each).
  const MEASURED_TOKENS_PER_SECOND = 120
  // The longest of those five completions.
  const MEASURED_CEILING_TOKENS = 3026

  it('allows more tokens than the longest completion actually measured', () => {
    // 2800 sat below this, so the longer half of the natural sampling spread
    // came back as truncated JSON and lost the whole reading after billing.
    expect(SECTIONS_MAX_TOKENS).toBeGreaterThan(MEASURED_CEILING_TOKENS)
  })

  it('waits longer than the completion it allows takes to produce', () => {
    // Raising the token ceiling without raising this only turns a truncated
    // reading into a timed-out one.
    const worstCaseMs = (SECTIONS_MAX_TOKENS / MEASURED_TOKENS_PER_SECOND) * 1000
    expect(SECTIONS_TIMEOUT_MS).toBeGreaterThan(worstCaseMs)
  })
})

describe('daily generation cap', () => {
  it('matches the limit the SQL function actually enforces', () => {
    // The TS copy only feeds the "N left today" line; the SQL one is what holds
    // the cap. Drift between them would show the reader a number that is not the
    // one they are being held to.
    const sql = readFileSync('sql/53.tuvi_daily_usage.sql', 'utf8')
    const limit = /v_limit\s+CONSTANT\s+INT\s*:=\s*(\d+)/.exec(sql)?.[1]
    expect(Number(limit)).toBe(TUVI_DAILY_LIMIT)
  })

  it('exempts the roles the brake is not aimed at', () => {
    expect(isUnlimitedTuviRole('admin')).toBe(true)
    expect(isUnlimitedTuviRole('paid')).toBe(true)
  })

  it('still holds an ordinary reader, including one with no role row', () => {
    expect(isUnlimitedTuviRole('user')).toBe(false)
    expect(isUnlimitedTuviRole(null)).toBe(false)
    expect(isUnlimitedTuviRole(undefined)).toBe(false)
  })
})
