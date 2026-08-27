import { describe, expect, it } from 'vitest'
import {
  matchableStarName,
  normalizeName,
  PALACE_BATCHES,
  PALACE_VERSION,
  palaceReadingsToList,
  parsePalaceReadings,
  readCachedPalaces,
} from './horoscope-interpretation'

describe('normalizeName', () => {
  it('strips diacritics and lower-cases', () => {
    expect(normalizeName('Thiên Di')).toBe('thien di')
    expect(normalizeName('Phúc Đức')).toBe('phuc duc')
  })

  it('handles đ, which NFD does not decompose', () => {
    expect(normalizeName('Điền Trạch')).toBe('dien trach')
  })

  it('collapses whitespace and trims', () => {
    expect(normalizeName('  Tài   Bạch ')).toBe('tai bach')
  })

  it('makes a missing tone mark match', () => {
    expect(normalizeName('Thiên Di')).toBe(normalizeName('Thien Di'))
  })
})

describe('parsePalaceReadings', () => {
  const valid = {
    cung: [
      {
        ten: 'Thiên Di',
        sao: [
          { ten: 'Phá Quân', y: 'Ra ngoài thích tự do, dễ có nhiều bước ngoặt.' },
          { ten: 'Đế Vượng', y: 'Khí thế mạnh, thể hiện bản thân tốt.' },
        ],
        tongQuan: 'Ra ngoài mạnh mẽ, năng động.',
      },
    ],
  }

  it('reads a palace, its star lines and its summary', () => {
    const palaces = parsePalaceReadings(valid)
    expect(Object.keys(palaces)).toEqual(['thien di'])
    expect(palaces['thien di'].stars).toEqual([
      { name: 'Phá Quân', text: 'Ra ngoài thích tự do, dễ có nhiều bước ngoặt.' },
      { name: 'Đế Vượng', text: 'Khí thế mạnh, thể hiện bản thân tốt.' },
    ])
    expect(palaces['thien di'].summary).toBe('Ra ngoài mạnh mẽ, năng động.')
  })

  it('returns an empty map rather than throwing on junk', () => {
    expect(parsePalaceReadings(null)).toEqual({})
    expect(parsePalaceReadings('nope')).toEqual({})
    expect(parsePalaceReadings({})).toEqual({})
    expect(parsePalaceReadings({ cung: 'not an array' })).toEqual({})
    expect(parsePalaceReadings({ cung: [1, null, 'x'] })).toEqual({})
  })

  it('drops star entries missing a name or a meaning', () => {
    const palaces = parsePalaceReadings({
      cung: [
        {
          ten: 'Mệnh',
          sao: [{ ten: 'Liêm Trinh' }, { y: 'không có tên sao' }, { ten: '  ', y: 'trống' }],
          tongQuan: 'Bản mệnh vững.',
        },
      ],
    })
    expect(palaces['menh'].stars).toEqual([])
    expect(palaces['menh'].summary).toBe('Bản mệnh vững.')
  })

  it('keeps a palace that has star lines but no summary', () => {
    const palaces = parsePalaceReadings({
      cung: [{ ten: 'Nô Bộc', sao: [{ ten: 'Thiên Cơ', y: 'Bạn bè nhiều mưu lược.' }] }],
    })
    expect(palaces['no boc'].summary).toBe('')
    expect(palaces['no boc'].stars).toHaveLength(1)
  })

  it('drops a palace that carries nothing at all', () => {
    // An empty panel reads as a loading failure, so it must not be stored.
    expect(parsePalaceReadings({ cung: [{ ten: 'Tật Ách', sao: [], tongQuan: '   ' }] })).toEqual({})
  })

  it('drops an entry with no palace name', () => {
    expect(parsePalaceReadings({ cung: [{ sao: [{ ten: 'A', y: 'B' }] }] })).toEqual({})
  })
})

describe('readCachedPalaces', () => {
  const fingerprint = 'fp'
  const lunarMonth = '2026-7-13'
  const stored = {
    palaces: [{ ten: 'Thiên Di', sao: [{ ten: 'Phá Quân', y: 'Thích tự do.' }], tongQuan: 'Năng động.' }],
    version: PALACE_VERSION,
    profileFingerprint: fingerprint,
    lunarMonth,
  }

  it('returns the readings when identity and version all match', () => {
    expect(readCachedPalaces(stored, fingerprint, lunarMonth)).toEqual({
      'thien di': { stars: [{ name: 'Phá Quân', text: 'Thích tự do.' }], summary: 'Năng động.' },
    })
  })

  it('misses when the birth data changed', () => {
    expect(readCachedPalaces(stored, 'other', lunarMonth)).toBeNull()
  })

  it('misses when the lunar day rolled over', () => {
    expect(readCachedPalaces(stored, fingerprint, '2026-7-14')).toBeNull()
  })

  it('misses when an older palace prompt wrote it', () => {
    expect(readCachedPalaces({ ...stored, version: PALACE_VERSION - 1 }, fingerprint, lunarMonth)).toBeNull()
    const { version: _version, ...unversioned } = stored
    expect(readCachedPalaces(unversioned, fingerprint, lunarMonth)).toBeNull()
  })

  it('treats an empty record as a miss, not as "no reading"', () => {
    // Otherwise the panel is pinned to empty for the rest of the lunar day with
    // no way to ask again.
    expect(readCachedPalaces({ ...stored, palaces: [] }, fingerprint, lunarMonth)).toBeNull()
  })

  it('misses on junk instead of handing it to the UI', () => {
    expect(readCachedPalaces(undefined, fingerprint, lunarMonth)).toBeNull()
    expect(readCachedPalaces('nope', fingerprint, lunarMonth)).toBeNull()
  })
})

describe('PALACE_BATCHES', () => {
  it('covers all twelve branch indexes exactly once', () => {
    // A missing index silently drops a palace from every reading; a duplicated
    // one bills for the same palace twice.
    expect([...PALACE_BATCHES.flat()].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ])
  })

  it('splits them evenly, so neither batch is the one that overruns', () => {
    expect(PALACE_BATCHES.map((batch) => batch.length)).toEqual([6, 6])
  })
})

describe('matchableStarName', () => {
  // Every case below is a real name the model returned for this chart, paired
  // with what the chart itself holds. Before this they all failed to match and
  // their readings disappeared without a trace.
  it.each([
    ['Tả Phù (hóa Khoa)', 'Tả Phù'],
    ['Thiên Lương (hóa Lộc)', 'Thiên Lương'],
    ['Tử Vi (hóa Quyền)', 'Tử Vi'],
    ['Vũ Khúc (hóa Kỵ)', 'Vũ Khúc'],
    ['Tràng Sinh: Mộ', 'Mộ'],
    ['Tràng Sinh: Đế Vượng', 'Đế Vượng'],
    ['Tràng Sinh: Trường Sinh', 'Trường Sinh'],
  ])('matches %s to %s', (fromModel, fromChart) => {
    expect(matchableStarName(fromModel)).toBe(matchableStarName(fromChart))
  })

  it('leaves a plain name alone', () => {
    expect(matchableStarName('Thiên Cơ')).toBe('thien co')
  })

  it('still tells two different stars apart', () => {
    expect(matchableStarName('Tả Phù (hóa Khoa)')).not.toBe(matchableStarName('Hữu Bật'))
    expect(matchableStarName('Tràng Sinh: Mộ')).not.toBe(matchableStarName('Tràng Sinh: Tuyệt'))
  })

  it('only strips a parenthetical at the end, not one inside a name', () => {
    expect(matchableStarName('Thiên (x) Cơ')).toBe('thien (x) co')
  })
})

describe('palaceReadingsToList', () => {
  const readings = parsePalaceReadings({
    cung: [
      {
        ten: 'Thiên Di',
        sao: [{ ten: 'Phá Quân', y: 'Ra ngoài thích tự do.' }],
        tongQuan: 'Ra ngoài mạnh mẽ.',
      },
    ],
  })

  it('round-trips through parsePalaceReadings', () => {
    // Everything that carries palaces out of the route — the cache record and
    // the HTTP response alike — goes through this, so it all re-enters the app
    // through the same parser a fresh completion does. A response that shipped
    // the keyed record instead parsed as nothing at all, and the panel reported
    // a generation failure for readings that had arrived intact.
    expect(parsePalaceReadings({ cung: palaceReadingsToList(readings) })).toEqual(readings)
  })

  it('produces the shape readCachedPalaces reads back', () => {
    expect(
      readCachedPalaces(
        {
          palaces: palaceReadingsToList(readings),
          version: PALACE_VERSION,
          lunarMonth: '2026-7-14',
          profileFingerprint: 'fp',
        },
        'fp',
        '2026-7-14',
      ),
    ).toEqual(readings)
  })
})
