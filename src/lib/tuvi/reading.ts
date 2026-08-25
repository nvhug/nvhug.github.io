// The whole computed layer of a tu vi reading: a pure function of the saved
// profile and the date it is being viewed on. Holds no state and performs no
// I/O, so the same inputs always give the same reading (spec FR-006, SC-002).
import type { SolarDate } from '../lunar-calendar'
import type { HoroscopeProfile } from '../horoscope-profile'
import {
  dayPillar,
  hourPillar,
  monthPillar,
  napAm,
  pillarName,
  yearPillar,
  zodiacAnimal,
} from './can-chi'
import { birthMoment } from './birth-moment'
import { buildChart, runsForward } from './build-chart'
import { buildCycles, daiVanPalaceAtAge } from './cycles'
import { scoreChart } from './scoring'
import type { Reading } from './types'

// "Hậu vận" — the decade traditionally read for later-life fortune.
const LATER_LIFE_AGE = 60

export function buildReading(profile: HoroscopeProfile, todaySolar: SolarDate): Reading {
  // A birth in the late Tý hour is reckoned on the following day, so every
  // pillar below is derived from the resolved moment, not the raw stored date.
  const moment = birthMoment(profile)
  const lunar = moment.lunar
  const yearP = yearPillar(lunar.year)
  const dayP = dayPillar(moment.solar)
  const hourBranch = moment.hourBranch

  const chart = buildChart(profile)
  const cycles = buildCycles(profile, chart, todaySolar)
  const daiVanIndex = cycles.find((c) => c.key === 'daiVan')?.palaceIndex ?? null

  const palaces = chart.palaces.map((palace) => ({
    ...palace,
    isDaiVan: palace.index === daiVanIndex,
  }))

  const forward = runsForward(yearP.stem, profile.gender)
  const laterLifeIndex =
    chart.menhIndex === null || !chart.cuc
      ? null
      : daiVanPalaceAtAge(chart.menhIndex, chart.cuc.number, forward, LATER_LIFE_AGE)
  const laterLifePalace = laterLifeIndex === null ? null : palaces[laterLifeIndex]

  return {
    pillars: {
      year: yearP,
      month: monthPillar(lunar.month, yearP.stem),
      day: dayP,
      hour: hourBranch === null ? null : hourPillar(dayP.stem, hourBranch),
    },
    yearName: pillarName(yearP),
    napAm: napAm(yearP.stem, yearP.branch),
    zodiac: zodiacAnimal(yearP.branch),
    chart: { ...chart, palaces },
    cycles,
    menh: palaces.find((p) => p.isMenh) ?? null,
    than: palaces.find((p) => p.isThan) ?? null,
    laterLifePalace,
    scores: chart.hourKnown ? scoreChart(palaces, daiVanIndex, laterLifePalace) : null,
  }
}
