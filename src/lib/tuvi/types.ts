// Shared types for the tu vi computation layer.

export type Element = 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ'

/** One Can Chi pair: a stem index 0..9 and a branch index 0..11. */
export type Pillar = { stem: number; branch: number }

export type NapAm = { name: string; element: Element }

export type Cuc = { element: Element; number: number; name: string }

export type Transform = 'loc' | 'quyen' | 'khoa' | 'ky'

export type Star = {
  name: string
  kind: 'chinh' | 'phu'
  transform?: Transform
}

export type Palace = {
  index: number
  /** Null until the birth hour anchors Mệnh, since the names run from it. */
  name: string | null
  pillar: Pillar
  stars: Star[]
  trangSinh: string | null
  tuan: boolean
  triet: boolean
  isMenh: boolean
  isThan: boolean
  isDaiVan: boolean
}

export type Chart = {
  palaces: Palace[]
  menhIndex: number | null
  thanIndex: number | null
  cuc: Cuc | null
  hourKnown: boolean
}

/**
 * Spans are structured rather than pre-formatted so the UI renders them in the
 * reader's own language; only the domain names (Can Chi, palace names) are
 * carried as text, because those are proper nouns in both languages.
 */
export type CycleSpan =
  | { kind: 'ageRange'; from: number; to: number }
  | { kind: 'ageFrom'; from: number }
  | { kind: 'lunarYear'; year: number }
  | { kind: 'lunarMonth'; month: number; leap: boolean }
  | { kind: 'needHour' }

export type Cycle = {
  key: 'daiVan' | 'luuNien' | 'luuNguyet'
  name: string | null
  span: CycleSpan
  palaceIndex: number | null
}

export type Scores = {
  overall: number
  areas: Record<'career' | 'wealth' | 'love' | 'family' | 'health', number>
  /** Mệnh's own score, undiluted by the Đại vận blend `overall` uses. */
  mindWillpower: number
  /** The Đại vận palace projected to age 60. */
  laterLife: number
  /** Share of "quý nhân" stars landing in Mệnh, Thân, or the current Đại vận. */
  luck: number
}

export type Reading = {
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null }
  yearName: string
  napAm: NapAm
  zodiac: string
  /** Traditional Vietnamese age (starts at one in the birth year), reckoned from
      the resolved birth lunar year so a late-Tý birth counts from the right one. */
  age: number
  chart: Chart
  cycles: Cycle[]
  menh: Palace | null
  than: Palace | null
  /** The Đại vận palace projected to age 60 ("Hậu vận"), null before the hour is known. */
  laterLifePalace: Palace | null
  scores: Scores | null
}
