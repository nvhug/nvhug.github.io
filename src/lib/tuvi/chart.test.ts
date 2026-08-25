import { describe, expect, it } from 'vitest'
import { BRANCHES, STEMS, monthPillar } from './can-chi'
import { cuc, majorStars, menhPalace, palaceStem, thanPalace, thienPhuPalace, tuViPalace } from './chart'

describe('menhPalace', () => {
  it('lands on Dần for someone born in lunar month 1 at the Tý hour', () => {
    expect(BRANCHES[menhPalace(1, 0)]).toBe('Dần')
  })

  it('counts forward to the month, then backward to the hour', () => {
    // Month 2 reaches Mão; counting back one hour (Sửu) returns to Dần.
    expect(BRANCHES[menhPalace(2, 1)]).toBe('Dần')
    // Month 5 reaches Ngọ; counting back to the Thìn hour lands on Dần.
    expect(BRANCHES[menhPalace(5, 4)]).toBe('Dần')
  })

  it('wraps around the twelve palaces', () => {
    expect(BRANCHES[menhPalace(1, 5)]).toBe('Dậu')
  })
})

describe('thanPalace', () => {
  it('counts forward to the month, then forward again to the hour', () => {
    expect(BRANCHES[thanPalace(1, 0)]).toBe('Dần')
    expect(BRANCHES[thanPalace(2, 1)]).toBe('Thìn')
  })

  it('coincides with Mệnh only for someone born at the Tý hour', () => {
    expect(thanPalace(7, 0)).toBe(menhPalace(7, 0))
    expect(thanPalace(7, 3)).not.toBe(menhPalace(7, 3))
  })
})

describe('cuc', () => {
  it('reads the element off the Mệnh palace own Can Chi', () => {
    // A Bính year opens month 1 with Canh Dần → Tùng Bách Mộc → Mộc tam cục.
    expect(cuc(2, 2)).toEqual({ element: 'Mộc', number: 3, name: 'Mộc tam cục' })
  })

  it('maps every element onto its cycle number', () => {
    const seen = new Map<string, number>()
    for (let yearStem = 0; yearStem < 10; yearStem++) {
      for (let palace = 0; palace < 12; palace++) {
        const value = cuc(palace, yearStem)
        seen.set(value.element, value.number)
      }
    }
    expect(Object.fromEntries(seen)).toEqual({
      Thủy: 2,
      Mộc: 3,
      Kim: 4,
      Thổ: 5,
      Hỏa: 6,
    })
  })
})

describe('tuViPalace', () => {
  it('places Tử Vi on the traditional first-of-the-month palace for each cục', () => {
    expect(BRANCHES[tuViPalace(2, 1)]).toBe('Sửu')
    expect(BRANCHES[tuViPalace(3, 1)]).toBe('Thìn')
    expect(BRANCHES[tuViPalace(4, 1)]).toBe('Hợi')
    expect(BRANCHES[tuViPalace(5, 1)]).toBe('Ngọ')
    expect(BRANCHES[tuViPalace(6, 1)]).toBe('Dậu')
  })

  it('steps forward one palace when the day divides the cục exactly', () => {
    expect(BRANCHES[tuViPalace(2, 2)]).toBe('Dần')
    expect(BRANCHES[tuViPalace(2, 4)]).toBe('Mão')
  })

  it('stays inside the twelve palaces for every day of a lunar month', () => {
    for (let day = 1; day <= 30; day++) {
      for (const cucNumber of [2, 3, 4, 5, 6]) {
        const palace = tuViPalace(cucNumber, day)
        expect(palace).toBeGreaterThanOrEqual(0)
        expect(palace).toBeLessThan(12)
      }
    }
  })
})

describe('majorStars', () => {
  it('reproduces the classic Tử Phủ Dần chart', () => {
    const byPalace = majorStars(2)
    const at = (branch: string) => byPalace[BRANCHES.indexOf(branch as never)].slice().sort()

    expect(at('Dần')).toEqual(['Thiên Phủ', 'Tử Vi'])
    expect(at('Mão')).toEqual(['Thái Âm'])
    expect(at('Thìn')).toEqual(['Tham Lang'])
    expect(at('Tỵ')).toEqual(['Cự Môn'])
    expect(at('Ngọ')).toEqual(['Liêm Trinh', 'Thiên Tướng'])
    expect(at('Mùi')).toEqual(['Thiên Lương'])
    expect(at('Thân')).toEqual(['Thất Sát'])
    expect(at('Dậu')).toEqual(['Thiên Đồng'])
    expect(at('Tuất')).toEqual(['Vũ Khúc'])
    expect(at('Hợi')).toEqual(['Thái Dương'])
    expect(at('Tý')).toEqual(['Phá Quân'])
    expect(at('Sửu')).toEqual(['Thiên Cơ'])
  })

  it('keeps Tử Vi and Thiên Phủ symmetric about the Dần–Thân axis', () => {
    // The six canonical Tử Vi pairings, one per position of the pair.
    const sameHouse = (branch: string, other: string) => {
      const stars = majorStars(BRANCHES.indexOf(branch as never))[BRANCHES.indexOf(branch as never)]
      expect(stars).toContain('Tử Vi')
      expect(stars).toContain(other)
    }
    sameHouse('Dần', 'Thiên Phủ')
    sameHouse('Sửu', 'Phá Quân')
    sameHouse('Mão', 'Tham Lang')
    sameHouse('Thìn', 'Thiên Tướng')
    sameHouse('Tỵ', 'Thất Sát')
  })

  it('places all fourteen major stars exactly once, wherever Tử Vi falls', () => {
    for (let tuVi = 0; tuVi < 12; tuVi++) {
      const placed = majorStars(tuVi).flat()
      expect(placed).toHaveLength(14)
      expect(new Set(placed).size).toBe(14)
    }
  })
})

// Externally-sourced checks (spec FR-019a). Placement rules and the worked
// example below come from published Vietnamese tu vi references, not from the
// same reasoning that wrote the implementation:
//   - lichngaytot.com "Các bước lập lá số tử vi" / aoiconcept.com — the worked
//     Mệnh/Thân example: born lunar month 6 at the Sửu hour → Mệnh at Ngọ,
//     Thân at Thân.
//   - tracuutuvi.com "An sao tử vi" — Mệnh counts forward from Dần to the birth
//     month then backward to the birth hour; Tử Vi comes from dividing the birth
//     day by the cục and borrowing the remainder; Thiên Phủ sits opposite Tử Vi;
//     Lộc Tồn for a Giáp year is at Dần; the Tràng Sinh cycle runs forward for a
//     yang man or yin woman.
//   - luantuvi.vn "Tinh Hệ Tử Phủ Dần Thân" — Tử Vi and Thiên Phủ share the
//     palace when it is Dần or Thân, which is what fixes the reflection axis.
describe('published reference cases', () => {
  it('matches the worked example: lunar month 6 at the Sửu hour', () => {
    expect(BRANCHES[menhPalace(6, 1)]).toBe('Ngọ')
    expect(BRANCHES[thanPalace(6, 1)]).toBe('Thân')
  })

  it('keeps Thiên Phủ diagonally opposite Tử Vi across the Dần–Thân axis', () => {
    expect(BRANCHES[thienPhuPalace(BRANCHES.indexOf('Dần' as never))]).toBe('Dần')
    expect(BRANCHES[thienPhuPalace(BRANCHES.indexOf('Thân' as never))]).toBe('Thân')
    expect(BRANCHES[thienPhuPalace(BRANCHES.indexOf('Tý' as never))]).toBe('Thìn')
  })
})

describe('palaceStem', () => {
  it('wraps forward around the twelve branches instead of counting backward', () => {
    // A Giáp year opens Dần with Bính, so counting forward reaches Bính Tý and
    // Đinh Sửu at the end of the loop — not Giáp Tý and Ất Sửu.
    expect(STEMS[palaceStem(0, 0)]).toBe('Bính')
    expect(STEMS[palaceStem(1, 0)]).toBe('Đinh')
    expect(STEMS[palaceStem(2, 0)]).toBe('Bính')
  })

  it('agrees with monthPillar, which encodes the same ngũ hổ độn rule', () => {
    for (let yearStem = 0; yearStem < 10; yearStem++) {
      for (let month = 1; month <= 12; month++) {
        const pillar = monthPillar(month, yearStem)
        expect(palaceStem(pillar.branch, yearStem)).toBe(pillar.stem)
      }
    }
  })
})

describe('cuc for a Mệnh palace at Tý or Sửu', () => {
  it('reads Thủy nhị cục for Mệnh at Tý in a Giáp year', () => {
    // Bính Tý is Giản Hạ Thủy → Thủy nhị cục.
    expect(cuc(0, 0)).toEqual({ element: 'Thủy', number: 2, name: 'Thủy nhị cục' })
  })

  it('reads Thủy nhị cục for Mệnh at Sửu in a Giáp year', () => {
    // Đinh Sửu is Giản Hạ Thủy as well.
    expect(cuc(1, 0)).toEqual({ element: 'Thủy', number: 2, name: 'Thủy nhị cục' })
  })
})
