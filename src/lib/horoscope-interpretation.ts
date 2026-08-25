// Pure helpers behind the AI interpretation: what identifies a reading (so a
// cached one can be reused or invalidated) and what the model is asked.
// The HTTP call itself lives in app/api/tu-vi/interpret/route.ts.
import { solarToLunar, type SolarDate } from './lunar-calendar'
import type { HoroscopeProfile } from './horoscope-profile'
import {
  AREA_PALACE,
  explainPalaceScore,
  findWeakestArea,
  luckKeyPalaceIndexes,
  QUY_NHAN_STARS,
  TRANSFORM_LABEL,
  type Area,
  type ScoreBreakdown,
} from './tuvi/scoring'
import type { Palace, Reading } from './tuvi/types'

/**
 * Identifies the birth data a reading was written for. A cached interpretation
 * is reused only while this is unchanged, so editing any birth field
 * invalidates it without a separate invalidation path (spec FR-014).
 */
export function profileFingerprint(profile: HoroscopeProfile): string {
  return [
    profile.birthDateSolar,
    profile.birthTimeUnknown ? 'unknown' : (profile.birthTime ?? ''),
    profile.gender,
  ].join('|')
}

/**
 * Interpretations refresh once per lunar day, not per Gregorian day (FR-020).
 * The leap flag is part of the key: without it, day D of leap month N and of
 * regular month N collide and a month-old reading is re-served as fresh.
 */
export function lunarDayKey(todaySolar: SolarDate): string {
  const lunar = solarToLunar(todaySolar)
  return `${lunar.year}-${lunar.month}${lunar.isLeapMonth ? 'n' : ''}-${lunar.day}`
}

export type InterpretationLang = 'vi' | 'en'

/** Vietnamese wording for the prompt only; the UI renders spans in its own language. */
function describeSpan(span: Reading['cycles'][number]['span']): string {
  switch (span.kind) {
    case 'ageRange':
      return `${span.from}-${span.to} tuổi`
    case 'ageFrom':
      return `từ ${span.from} tuổi`
    case 'lunarYear':
      return `năm âm lịch ${span.year}`
    case 'lunarMonth':
      return `tháng ${span.month}${span.leap ? ' nhuận' : ''} âm lịch`
    case 'needHour':
      return 'chưa xác định vì không rõ giờ sinh'
  }
}

/**
 * Same star-and-arithmetic breakdown the overview page shows under each
 * scored item, rendered as one prompt line. The model is told to write its
 * paragraph FROM these specific stars and this specific arithmetic, not just
 * restate the final percent — otherwise "72/100" reads as unexplained to anyone
 * comparing it against the chart on screen.
 */
function formatBreakdown(label: string, palaceName: string, breakdown: ScoreBreakdown): string {
  const starsText =
    breakdown.stars.length > 0
      ? breakdown.stars
          .map(
            (star) =>
              `${star.name}${star.transform ? ` (hóa ${TRANSFORM_LABEL[star.transform]})` : ''} ${
                star.weight >= 0 ? '+' : ''
              }${star.weight}`,
          )
          .join(', ')
      : 'vô chính diệu'
  const marks = [breakdown.tuan ? 'Tuần' : '', breakdown.triet ? 'Triệt' : ''].filter(Boolean).join(', ')
  const totalText = breakdown.dampened
    ? `tổng gốc ${breakdown.rawTotal}, có ${marks} nên chia đôi còn ${breakdown.total}`
    : `tổng ${breakdown.total}`

  return `${label} (${palaceName}): ${starsText}${marks ? ` (${marks})` : ''} — ${totalText} → ${breakdown.percent}/100`
}

function palaceBreakdownLine(label: string, palace: Palace | undefined): string {
  if (!palace) return `${label}: chưa xác định`
  return formatBreakdown(label, palace.name ?? '?', explainPalaceScore(palace))
}

function areaBreakdownLine(reading: Reading, areaLabel: string, palaceName: string): string {
  return palaceBreakdownLine(areaLabel, reading.chart.palaces.find((p) => p.name === palaceName))
}

/** Which quý nhân stars actually landed in Mệnh, Thân, the current Đại vận,
    or one of the five life areas — same footprint scoring.ts's luck uses. */
function luckLine(reading: Reading): string {
  const { menhIndex, thanIndex, palaces } = reading.chart
  if (menhIndex === null) return `Quý nhân/vận may: chưa xác định → ${reading.scores?.luck ?? 0}/100`

  const daiVanIndex = palaces.find((p) => p.isDaiVan)?.index ?? null
  const keyIndexes = luckKeyPalaceIndexes(palaces, menhIndex, thanIndex, daiVanIndex)
  const found = new Set<string>()
  for (const index of keyIndexes) {
    for (const star of palaces[index].stars) {
      if ((QUY_NHAN_STARS as readonly string[]).includes(star.name)) found.add(star.name)
    }
  }
  const percent = reading.scores?.luck ?? 0
  return found.size > 0
    ? `Quý nhân/vận may: ${[...found].join(', ')} rơi vào Mệnh/Thân/Đại vận/các cung lĩnh vực → ${percent}/100`
    : `Quý nhân/vận may: không có sao quý nhân nào rơi vào các cung liên quan → ${percent}/100`
}

const AREA_LABEL: Record<Area, string> = {
  career: 'Sự nghiệp',
  wealth: 'Tài lộc',
  love: 'Tình duyên',
  family: 'Gia đạo',
  health: 'Sức khỏe',
}

/**
 * Builds the prompt from values already computed locally. The model interprets
 * those numbers; it never decides them (spec FR-006, FR-010).
 */
export function buildInterpretationPrompt(
  reading: Reading,
  profile: HoroscopeProfile,
  lang: InterpretationLang = 'vi',
): string {
  const cycles = reading.cycles
    .map((c) => `${c.key}: ${c.name ?? 'chưa xác định'} (${describeSpan(c.span)})`)
    .join('\n')

  const weakest = reading.chart.hourKnown ? findWeakestArea(reading.chart.palaces) : null
  const weakestLine = weakest
    ? formatBreakdown(
        weakest.key === 'menh' ? 'Điểm cần chú ý (Mệnh)' : `Điểm cần chú ý (${AREA_LABEL[weakest.key]})`,
        weakest.key === 'menh' ? 'Mệnh' : AREA_PALACE[weakest.key],
        weakest.breakdown,
      )
    : 'Chưa xác định được cung yếu nhất.'

  const chartBlock = reading.chart.hourKnown
    ? [
        `Cục: ${reading.chart.cuc?.name}`,
        palaceBreakdownLine('Tư duy, bản lĩnh', reading.menh ?? undefined),
        ...(Object.entries(AREA_PALACE) as [Area, string][]).map(([area, palaceName]) =>
          areaBreakdownLine(reading, AREA_LABEL[area], palaceName),
        ),
        palaceBreakdownLine('Hậu vận (đại vận từ tuổi 60)', reading.laterLifePalace ?? undefined),
        luckLine(reading),
        weakestLine,
      ].join('\n')
    : 'Đương số không rõ giờ sinh nên chưa lập được lá số; chỉ luận theo can chi năm, tháng, ngày.'

  // Every other score already ends its own line inside chartBlock above; this
  // only adds the one number that line doesn't cover.
  const scoreBlock = reading.scores
    ? `Điểm tổng quan (thang 0-100): ${reading.scores.overall}.`
    : 'Chưa có điểm số vì chưa lập được lá số.'

  return `Bạn là người luận giải tử vi Việt Nam, viết cho người đọc phổ thông.

Số liệu đã được tính sẵn — nhiệm vụ của bạn là diễn giải, tuyệt đối không tự đổi số:
- Năm sinh: ${reading.yearName}, nạp âm ${reading.napAm.name} (${reading.napAm.element}), tuổi ${reading.zodiac}
- Giới tính: ${profile.gender}
${chartBlock}
${cycles}
${scoreBlock}

${
    lang === 'en'
      ? `Requirements:
- Write in natural English, calm in tone, no scare tactics and no absolute promises.
- Keep the Vietnamese astrology terms above as they are; they are proper nouns.
- Stay with the figures given; if there is no chart yet, say plainly that a birth hour is needed.
- Every key below is an object with two fields, "short" and "detail" — not a plain string.
  - "short": ONE concise sentence (roughly 8-15 words), written like a table caption a reader
    scans at a glance. It must stand alone without the score (shown as x/100) next to it repeating the number.
  - "detail": for every scored section (tuDuy, suNghiep, taiLoc, tinhDuyen, giaDao, sucKhoe,
    hauVan, quyNhan, diemYeu), ground it in the specific stars and arithmetic listed for that
    palace above — name the star(s) driving the score up or down, and if Tuần/Triệt halved the
    total, say so plainly. Go beyond naming the stars: explain WHY that combination matters in
    practice for this person, with the depth of an experienced reader, not a generic horoscope.
    Three to five sentences, concrete and actionable, no filler that could apply to anyone.
- diemYeu is about the single lowest-scoring palace listed above ("Điểm cần chú ý") — name it
  plainly as a caution, not a verdict, and suggest one concrete way to offset it.
- tongQuan and vanHan need "detail" written the same way; their "short" can be a plain one-line
  summary since they are not shown in the table.`
      : `Yêu cầu:
- Viết tiếng Việt tự nhiên, giọng điềm đạm, không hù dọa, không hứa hẹn tuyệt đối.
- Bám sát số liệu trên; nếu chưa có lá số thì nói rõ cần bổ sung giờ sinh.
- Mỗi khóa dưới đây là một object có 2 trường "short" và "detail" — không phải một chuỗi thường.
  - "short": ĐÚNG MỘT câu ngắn (khoảng 8-15 từ), viết như phần chú thích trong bảng để đọc lướt là
    hiểu ngay. Không lặp lại con số điểm (dạng x/100) đứng cạnh nó.
  - "detail": với mỗi mục có điểm số (tuDuy, suNghiep, taiLoc, tinhDuyen, giaDao, sucKhoe, hauVan,
    quyNhan, diemYeu), phải giải thích dựa trên đúng các sao và phép tính đã cho ở cung tương ứng
    bên trên — nêu tên sao nào kéo điểm lên/xuống, và nếu có Tuần/Triệt làm chia đôi điểm thì nói
    rõ vì sao. Đi sâu hơn việc kể tên sao: giải thích VÌ SAO tổ hợp đó có ý nghĩa thực tế với người
    này — viết với độ sâu và cụ thể như một người luận giải có kinh nghiệm, không viết chung chung
    kiểu có thể áp dụng cho ai cũng được. Mỗi mục 3-5 câu, cụ thể, có thể hành động được.
- diemYeu nói về đúng cung điểm thấp nhất ở trên ("Điểm cần chú ý") — nêu rõ như một điều cần lưu ý,
  không phải một lời phán xét, và gợi ý một cách cụ thể để cải thiện/bù đắp.
- tongQuan và vanHan cũng cần "detail" viết như trên; "short" của hai mục này có thể là một câu tóm
  tắt bình thường vì không hiển thị trong bảng.`
  }

Trả về đúng một object JSON (return exactly one JSON object). Mỗi giá trị là { "short": "...", "detail": "..." }:
{
  "tongQuan": { "short": "...", "detail": "nhận định chung về bản mệnh, dẫn nạp âm và cung Mệnh" },
  "tuDuy": { "short": "...", "detail": "nhận định về tư duy, bản lĩnh từ cung Mệnh" },
  "suNghiep": { "short": "...", "detail": "..." },
  "taiLoc": { "short": "...", "detail": "..." },
  "tinhDuyen": { "short": "...", "detail": "..." },
  "giaDao": { "short": "...", "detail": "..." },
  "sucKhoe": { "short": "...", "detail": "..." },
  "hauVan": { "short": "...", "detail": "nhận định về hậu vận (đại vận từ tuổi 60)" },
  "quyNhan": { "short": "...", "detail": "nhận định về quý nhân/vận may" },
  "vanHan": { "short": "...", "detail": "nhận định về đại vận, lưu niên và lưu nguyệt hiện tại" },
  "diemYeu": { "short": "...", "detail": "nhận định về điểm cần chú ý nhất" }
}`
}

// The sections the overview actually renders. Anything else the model returns
// is dropped rather than stored and handed to React.
const SECTION_KEYS = [
  'tongQuan', 'tuDuy', 'suNghiep', 'taiLoc', 'tinhDuyen', 'giaDao', 'sucKhoe',
  'hauVan', 'quyNhan', 'vanHan', 'diemYeu',
] as const

// vanHan and diemYeu stay optional, same as before: vanHan already was, and
// diemYeu depends on there being one palace clearly weaker than the rest. A
// truncated response for anything else has to read as a miss, or one bad
// generation is cached and served for the rest of the lunar day with a retry
// button that only re-hits the cache.
const REQUIRED_SECTION_KEYS = [
  'tongQuan', 'tuDuy', 'suNghiep', 'taiLoc', 'tinhDuyen', 'giaDao', 'sucKhoe', 'hauVan', 'quyNhan',
] as const

export type ParsedSection = { short: string; detail: string }

function isSection(value: unknown): value is ParsedSection {
  if (typeof value !== 'object' || value === null) return false
  const { short, detail } = value as Record<string, unknown>
  return typeof short === 'string' && short.trim() !== '' && typeof detail === 'string' && detail.trim() !== ''
}

/**
 * Validates a model response before it is cached or rendered. Anything that
 * isn't a well-formed { short, detail } object (a plain string from an older
 * shape, a nested array, a number) would otherwise be persisted and then
 * crash the page on every view until the lunar day rolled over.
 */
export function parseInterpretationSections(raw: unknown): Record<string, ParsedSection> | null {
  if (typeof raw !== 'object' || raw === null) return null

  const source = raw as Record<string, unknown>
  const sections: Record<string, ParsedSection> = {}
  for (const key of SECTION_KEYS) {
    const value = source[key]
    if (isSection(value)) sections[key] = { short: value.short, detail: value.detail }
  }

  return REQUIRED_SECTION_KEYS.every((key) => sections[key]) ? sections : null
}

/**
 * Today's date in Vietnam (UTC+7, no DST). Both the page and the API route use
 * this, so the cycles on screen and the interpretation beside them always
 * describe the same day, whatever timezone the viewer is in.
 */
export function vietnamTodaySolar(now: Date): SolarDate {
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return {
    day: local.getUTCDate(),
    month: local.getUTCMonth() + 1,
    year: local.getUTCFullYear(),
  }
}

/**
 * Reads a stored interpretation only if it is still valid for this birth data
 * and lunar day AND its shape survives validation. A malformed record — a
 * hand-written row, or one written by an older shape — must read as a cache
 * miss, not be handed to the UI where it would throw on every view until the
 * lunar day rolled over.
 */
export function readCachedInterpretation(
  stored: unknown,
  fingerprint: string,
  lunarDay: string,
): Record<string, ParsedSection> | null {
  if (typeof stored !== 'object' || stored === null) return null

  const record = stored as Record<string, unknown>
  if (record.profileFingerprint !== fingerprint || record.lunarDay !== lunarDay) return null

  return parseInterpretationSections(record.sections)
}
