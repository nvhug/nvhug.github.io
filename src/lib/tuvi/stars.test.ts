import { describe, expect, it } from 'vitest'
import { BRANCHES, STEMS, yearPillar } from './can-chi'
import {
  branchStars,
  fourTransforms,
  hoaLinhStars,
  hourStars,
  monthStars,
  stemStars,
  trangSinh,
  trietBranches,
  tuanBranches,
} from './stars'

const branch = (name: string) => BRANCHES.indexOf(name as never)
const stem = (name: string) => STEMS.indexOf(name as never)

describe('monthStars', () => {
  it('starts Tả Phù at Thìn and Hữu Bật at Tuất for lunar month 1', () => {
    expect(monthStars(1)).toEqual({ 'Tả Phù': branch('Thìn'), 'Hữu Bật': branch('Tuất') })
  })

  it('moves Tả Phù forward and Hữu Bật backward with each month', () => {
    expect(monthStars(3)['Tả Phù']).toBe(branch('Ngọ'))
    expect(monthStars(3)['Hữu Bật']).toBe(branch('Thân'))
  })
})

describe('hourStars', () => {
  it('starts Văn Xương at Tuất and Văn Khúc at Thìn for the Tý hour', () => {
    expect(hourStars(0)['Văn Xương']).toBe(branch('Tuất'))
    expect(hourStars(0)['Văn Khúc']).toBe(branch('Thìn'))
  })

  it('puts both Địa Không and Địa Kiếp at Hợi for the Tý hour', () => {
    expect(hourStars(0)['Địa Không']).toBe(branch('Hợi'))
    expect(hourStars(0)['Địa Kiếp']).toBe(branch('Hợi'))
  })

  it('separates Không and Kiếp for any other hour', () => {
    const stars = hourStars(4)
    expect(stars['Địa Không']).not.toBe(stars['Địa Kiếp'])
  })
})

describe('stemStars', () => {
  it('places Lộc Tồn at Dần for a Giáp year', () => {
    expect(stemStars(stem('Giáp'))['Lộc Tồn']).toBe(branch('Dần'))
  })

  it('places Lộc Tồn at Thân for a Canh year', () => {
    expect(stemStars(stem('Canh'))['Lộc Tồn']).toBe(branch('Thân'))
  })

  it('flanks Lộc Tồn with Kình Dương ahead and Đà La behind', () => {
    const stars = stemStars(stem('Giáp'))
    expect(stars['Kình Dương']).toBe(branch('Mão'))
    expect(stars['Đà La']).toBe(branch('Sửu'))
  })

  it('pairs Thiên Khôi and Thiên Việt by stem group', () => {
    expect(stemStars(stem('Giáp'))['Thiên Khôi']).toBe(branch('Sửu'))
    expect(stemStars(stem('Giáp'))['Thiên Việt']).toBe(branch('Mùi'))
    expect(stemStars(stem('Tân'))['Thiên Khôi']).toBe(branch('Ngọ'))
    expect(stemStars(stem('Tân'))['Thiên Việt']).toBe(branch('Dần'))
  })
})

describe('branchStars', () => {
  it('places Đào Hoa and Thiên Mã by the four-branch group', () => {
    expect(branchStars(branch('Tý'))['Đào Hoa']).toBe(branch('Dậu'))
    expect(branchStars(branch('Tý'))['Thiên Mã']).toBe(branch('Dần'))
    expect(branchStars(branch('Ngọ'))['Đào Hoa']).toBe(branch('Mão'))
    expect(branchStars(branch('Ngọ'))['Thiên Mã']).toBe(branch('Thân'))
  })

  it('puts Hồng Loan at Mão for a Tý year and Thiên Hỷ opposite it', () => {
    const stars = branchStars(branch('Tý'))
    expect(stars['Hồng Loan']).toBe(branch('Mão'))
    expect(stars['Thiên Hỷ']).toBe(branch('Dậu'))
  })

  it('puts Thiên Khốc and Thiên Hư together at Ngọ for a Tý year', () => {
    const stars = branchStars(branch('Tý'))
    expect(stars['Thiên Khốc']).toBe(branch('Ngọ'))
    expect(stars['Thiên Hư']).toBe(branch('Ngọ'))
  })

  it('places Cô Thần and Quả Tú by the seasonal group', () => {
    expect(branchStars(branch('Tý'))['Cô Thần']).toBe(branch('Dần'))
    expect(branchStars(branch('Tý'))['Quả Tú']).toBe(branch('Tuất'))
    expect(branchStars(branch('Mão'))['Cô Thần']).toBe(branch('Tỵ'))
  })
})

describe('fourTransforms', () => {
  it('applies the Giáp year transforms', () => {
    expect(fourTransforms(stem('Giáp'))).toEqual({
      'Liêm Trinh': 'loc',
      'Phá Quân': 'quyen',
      'Vũ Khúc': 'khoa',
      'Thái Dương': 'ky',
    })
  })

  it('applies the Canh year transforms', () => {
    expect(fourTransforms(stem('Canh'))).toEqual({
      'Thái Dương': 'loc',
      'Vũ Khúc': 'quyen',
      'Thái Âm': 'khoa',
      'Thiên Đồng': 'ky',
    })
  })

  it('gives every stem exactly four distinct transformed stars', () => {
    for (let s = 0; s < 10; s++) {
      const table = fourTransforms(s)
      expect(Object.keys(table)).toHaveLength(4)
      expect(new Set(Object.values(table)).size).toBe(4)
    }
  })
})

describe('trangSinh', () => {
  it('starts Trường Sinh at Thân for a Thủy nhị cục', () => {
    const cycle = trangSinh(2, true)
    expect(cycle[branch('Thân')]).toBe('Trường Sinh')
  })

  it('starts Trường Sinh at Hợi for a Mộc tam cục and Tỵ for a Kim tứ cục', () => {
    expect(trangSinh(3, true)[branch('Hợi')]).toBe('Trường Sinh')
    expect(trangSinh(4, true)[branch('Tỵ')]).toBe('Trường Sinh')
  })

  it('runs forward or backward depending on direction', () => {
    expect(trangSinh(2, true)[branch('Dậu')]).toBe('Mộc Dục')
    expect(trangSinh(2, false)[branch('Mùi')]).toBe('Mộc Dục')
  })

  it('fills all twelve palaces with distinct stages', () => {
    const cycle = trangSinh(6, true)
    expect(new Set(cycle).size).toBe(12)
  })
})

describe('tuanBranches', () => {
  it('voids Tuất and Hợi for a Canh Ngọ year, which sits in the Giáp Tý decade', () => {
    const { stem: s, branch: b } = yearPillar(1990)
    expect(tuanBranches(s, b)).toEqual([branch('Tuất'), branch('Hợi')])
  })

  it('always voids two adjacent branches', () => {
    for (let year = 1900; year < 1960; year++) {
      const { stem: s, branch: b } = yearPillar(year)
      const [first, second] = tuanBranches(s, b)
      expect((first + 1) % 12).toBe(second)
    }
  })
})

describe('trietBranches', () => {
  it('voids Ngọ and Mùi for an Ất or Canh year', () => {
    expect(trietBranches(stem('Canh'))).toEqual([branch('Ngọ'), branch('Mùi')])
    expect(trietBranches(stem('Ất'))).toEqual([branch('Ngọ'), branch('Mùi')])
  })

  it('voids Thân and Dậu for a Giáp or Kỷ year', () => {
    expect(trietBranches(stem('Giáp'))).toEqual([branch('Thân'), branch('Dậu')])
    expect(trietBranches(stem('Kỷ'))).toEqual([branch('Thân'), branch('Dậu')])
  })
})

describe('hoaLinhStars', () => {
  it('starts Hỏa Tinh at Sửu and Linh Tinh at Mão for the Dần-Ngọ-Tuất group', () => {
    expect(hoaLinhStars(branch('Ngọ'), 0)['Hỏa Tinh']).toBe(branch('Sửu'))
    expect(hoaLinhStars(branch('Ngọ'), 0)['Linh Tinh']).toBe(branch('Mão'))
  })

  it('starts Hỏa Tinh at Dần for the Thân-Tý-Thìn group', () => {
    expect(hoaLinhStars(branch('Tý'), 0)['Hỏa Tinh']).toBe(branch('Dần'))
    expect(hoaLinhStars(branch('Thìn'), 0)['Linh Tinh']).toBe(branch('Tuất'))
  })

  it('starts Hỏa Tinh at Mão for the Tỵ-Dậu-Sửu group and Dậu for Hợi-Mão-Mùi', () => {
    expect(hoaLinhStars(branch('Dậu'), 0)['Hỏa Tinh']).toBe(branch('Mão'))
    expect(hoaLinhStars(branch('Mùi'), 0)['Hỏa Tinh']).toBe(branch('Dậu'))
  })

  it('counts forward from the starting palace by the birth hour', () => {
    expect(hoaLinhStars(branch('Ngọ'), 3)['Hỏa Tinh']).toBe(branch('Thìn'))
  })
})
