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
import { BRANCHES, STEMS } from './tuvi/can-chi'
import type { Palace, Reading } from './tuvi/types'

/**
 * Bumped whenever buildInterpretationPrompt changes in a way that makes older
 * prose wrong rather than merely different. Part of the cache identity, so a
 * prompt fix reaches readers on their next view instead of waiting for the lunar
 * day to roll over — which is how a reading that quoted the wrong score stayed
 * on screen after the prompt that allowed it had already been fixed.
 *
 * 2: no field may print a score; the score is on screen beside the prose.
 * 3: per-palace star readings folded into this same response. Withdrawn in 4:
 *    eleven sections plus twelve palaces could not finish inside the request
 *    timeout, so every attempt lost the whole reading.
 * 4: back to the shape that completed in time. Palaces have their own prompt,
 *    route and version now.
 */
export const INTERPRETATION_VERSION = 4

/**
 * What one sections completion is allowed to cost in output tokens.
 *
 * Measured rather than guessed: five real completions across four charts ran
 * 2331-3026 output tokens, the same chart varying by ~600 between runs because
 * the request is sampled at temperature 0.6. The previous 2800 sat inside that
 * spread, so the longer half of it came back cut off mid-JSON — billed, then
 * thrown away, which is the 502 a reader saw. This clears the observed ceiling
 * with room for a chart carrying more stars than any of those four.
 */
export const SECTIONS_MAX_TOKENS = 4000

/**
 * How long the route waits for that completion. It has to exceed
 * SECTIONS_MAX_TOKENS at the observed output rate (~120 tokens/s, so ~33s),
 * or raising the token ceiling only turns the truncated readings into timed-out
 * ones. Kept under the route's maxDuration so the failure is a diagnosable 504
 * rather than the platform killing the request.
 */
export const SECTIONS_TIMEOUT_MS = 50_000

/** Versions the palace readings on their own, since they have their own prompt.
 *
 * 2: generated six palaces at a time. All twelve in one completion always hit
 *    max_tokens and came back as truncated JSON.
 */
export const PALACE_VERSION = 2

/**
 * How many generations one reader may spend per lunar day, per bucket.
 *
 * Mirrors `v_limit` in sql/tuvi_daily_usage.sql, which is the copy that actually
 * enforces it — this one exists only so the screen can say how many are left
 * without a round trip the SQL function has no way to answer. A test reads the
 * .sql file and fails if the two ever drift.
 */
export const TUVI_DAILY_LIMIT = 6

/**
 * Roles the daily cap does not apply to.
 *
 * The cap is an abuse brake, not a paid gate: the reading stays free for every
 * role (spec FR-018), and it exists only because the cache is keyed on birth
 * data, so editing the birth hour in a loop would otherwise bill without limit.
 * An admin or a paying reader is not the account that brake is aimed at, and an
 * admin tuning the prompt spends six in one sitting.
 */
export function isUnlimitedTuviRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'paid'
}

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
/**
 * Identifies one lunar DAY. This is the abuse brake's unit, not the cache's.
 *
 * Keep the two apart: the daily fuse exists so that editing a birth hour in a loop cannot
 * bill an unbounded number of completions, and it has to reset every day to do that job.
 * What a reading is still VALID for is a different question entirely — see
 * `lunarMonthKey`.
 */
export function lunarDayKey(todaySolar: SolarDate): string {
  const lunar = solarToLunar(todaySolar)
  return `${lunar.year}-${lunar.month}${lunar.isLeapMonth ? 'n' : ''}-${lunar.day}`
}

/**
 * Identifies one lunar MONTH, and is what a cached reading is keyed on.
 *
 * Nothing in a reading changes daily. `buildCycles` derives Đại vận and Lưu niên from the
 * lunar YEAR and Lưu nguyệt from the lunar YEAR and MONTH; no cycle is computed from the
 * day, and the prompt never mentions today's date. Keying the cache on the day therefore
 * threw away a perfectly valid reading every midnight and paid for a fresh one that said
 * the same thing in different words — roughly thirty completions a month where one would
 * do.
 *
 * The month is the real boundary: when Lưu nguyệt rolls over, the reading genuinely
 * changes, and that is exactly when it should be regenerated.
 */
export function lunarMonthKey(todaySolar: SolarDate): string {
  const lunar = solarToLunar(todaySolar)
  return `${lunar.year}-${lunar.month}${lunar.isLeapMonth ? 'n' : ''}`
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
- NEVER print a score. Every figure above is already on screen beside your text as a meter, so
  writing it again (as "66/100", "46%", "8/10", or any other form) can only contradict it. Name the
  stars and say which way they pull; the number is not yours to restate. This applies to every
  field below without exception, "detail" included.
- Every key below is an object with two fields, "short" and "detail" — not a plain string.
  - "short": ONE concise sentence (roughly 8-15 words), written like a table caption a reader
    scans at a glance. It must stand alone, without the score.
  - "detail": for every scored section (tuDuy, suNghiep, taiLoc, tinhDuyen, giaDao, sucKhoe,
    hauVan, quyNhan, diemYeu), ground it in the specific stars and arithmetic listed for that
    palace above — name the star(s) driving the score up or down, and if Tuần/Triệt halved the
    total, say what that weakening means in practice rather than restating the sum. Go beyond
    naming the stars: explain WHY that combination matters in
    practice for this person, with the depth of an experienced reader, not a generic horoscope.
    Three to five sentences, concrete and actionable, no filler that could apply to anyone.
- diemYeu is about the single lowest-scoring palace listed above ("Điểm cần chú ý") — name it
  plainly as a caution, not a verdict, and suggest one concrete way to offset it.
- tongQuan and vanHan need "detail" written the same way, and their "short" is a plain one-line
  summary — still with no score in it, since tongQuan's caption sits directly beside the overall meter.`
      : `Yêu cầu:
- Viết tiếng Việt tự nhiên, giọng điềm đạm, không hù dọa, không hứa hẹn tuyệt đối.
- Bám sát số liệu trên; nếu chưa có lá số thì nói rõ cần bổ sung giờ sinh.
- TUYỆT ĐỐI không viết lại con số điểm. Mọi con số ở trên đều đã hiển thị ngay cạnh bài viết của
  bạn dưới dạng thanh/vòng điểm, nên viết lại nó (dạng "66/100", "46%", "8/10" hay bất kỳ dạng nào)
  chỉ có thể gây ra mâu thuẫn. Hãy nêu tên sao và chiều tác động của nó; con số không phải việc của
  bạn. Quy tắc này áp dụng cho MỌI trường dưới đây, kể cả "detail".
- Mỗi khóa dưới đây là một object có 2 trường "short" và "detail" — không phải một chuỗi thường.
  - "short": ĐÚNG MỘT câu ngắn (khoảng 8-15 từ), viết như phần chú thích trong bảng để đọc lướt là
    hiểu ngay, và không chứa con số điểm.
  - "detail": với mỗi mục có điểm số (tuDuy, suNghiep, taiLoc, tinhDuyen, giaDao, sucKhoe, hauVan,
    quyNhan, diemYeu), phải giải thích dựa trên đúng các sao và phép tính đã cho ở cung tương ứng
    bên trên — nêu tên sao nào kéo điểm lên/xuống, và nếu có Tuần/Triệt làm chia đôi điểm thì nói rõ
    sự suy giảm đó có ý nghĩa gì trên thực tế, thay vì đọc lại phép tính (phép tính đã hiển thị sẵn
    ngay phía trên bài viết của bạn). Đi sâu hơn việc kể tên sao: giải thích VÌ SAO tổ hợp đó có ý nghĩa thực tế với người
    này — viết với độ sâu và cụ thể như một người luận giải có kinh nghiệm, không viết chung chung
    kiểu có thể áp dụng cho ai cũng được. Mỗi mục 3-5 câu, cụ thể, có thể hành động được.
- diemYeu nói về đúng cung điểm thấp nhất ở trên ("Điểm cần chú ý") — nêu rõ như một điều cần lưu ý,
  không phải một lời phán xét, và gợi ý một cách cụ thể để cải thiện/bù đắp.
- tongQuan và vanHan cũng cần "detail" viết như trên; "short" của hai mục này là một câu tóm tắt
  bình thường, vẫn không được chứa con số điểm.`
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

/**
 * Describes every palace and what it holds. Kept out of the sections prompt on
 * purpose: eleven sections plus twelve palaces of Vietnamese prose could not
 * finish inside one request's timeout, and sharing a single response meant the
 * slow palace block took the sections down with it every time.
 */
function describePalaces(reading: Reading, indexes: readonly number[]): string {
  return reading.chart.palaces
    .filter((palace) => indexes.includes(palace.index))
    .map((palace) => {
      const stars = palace.stars
        .map((star) => `${star.name}${star.transform ? ` (hóa ${TRANSFORM_LABEL[star.transform]})` : ''}`)
        .join(', ')
      const extras = [
        palace.trangSinh ? `Tràng Sinh: ${palace.trangSinh}` : '',
        palace.tuan ? 'Tuần' : '',
        palace.triet ? 'Triệt' : '',
      ].filter(Boolean)
      return `- ${palace.name} (${STEMS[palace.pillar.stem]} ${BRANCHES[palace.pillar.branch]}): ${
        stars || 'vô chính diệu'
      }${extras.length > 0 ? ` [${extras.join(', ')}]` : ''}`
    })
    .join('\n')
}

/** Without a birth hour the palaces have no names to read, so there is nothing
    to ask about and no completion worth billing. */
export function canReadPalaces(reading: Reading): boolean {
  return reading.chart.hourKnown
}

/**
 * The twelve palaces, split into the batches they are generated in.
 *
 * All twelve in one completion measured ~4650 output tokens, which at the
 * observed ~144 tokens/s needs longer than the platform allows a request to run.
 * Six at a time fits with room to spare, the two batches run concurrently, and a
 * batch that fails loses only its own half.
 */
export const PALACE_BATCHES: readonly (readonly number[])[] = [
  [5, 6, 7, 8, 4, 9],
  [3, 10, 2, 1, 0, 11],
]

/**
 * The per-palace prompt: what each star means in the palace it landed in. Asks
 * for nothing the sections prompt already covers, so the two never overlap and
 * either can fail without the other.
 */
export function buildPalacePrompt(
  reading: Reading,
  lang: InterpretationLang = 'vi',
  indexes: readonly number[] = PALACE_BATCHES.flat(),
): string {
  return `Bạn là người luận giải tử vi Việt Nam, viết cho người đọc phổ thông.

Lá số đã được lập sẵn. Dưới đây là các cung và những gì mỗi cung đang mang:

${describePalaces(reading, indexes)}

${
    lang === 'en'
      ? `Requirements:
- Write in natural English, calm in tone, no scare tactics and no absolute promises.
- Keep the Vietnamese astrology terms above exactly as they are; they are proper nouns.
- One entry per palace listed above, in that order, none skipped and none invented.
- For each palace, one line per star it holds: what that star means IN THAT PALACE specifically,
  15 to 25 words, plain and concrete, never filler that would fit any palace equally well.
- Treat the Tràng Sinh position as one more entry in that same list.
- Then "tongQuan" for the palace as a whole: one or two sentences, at most 40 words.
- Reproduce every palace name and star name exactly as written above.
- Never print a score or a percentage. Those are already on screen beside your text.`
      : `Yêu cầu:
- Viết tiếng Việt tự nhiên, giọng điềm đạm, không hù dọa, không hứa họn tuyệt đối.
- Mỗi cung một mục, đúng các cung đã liệt kê ở trên, theo thứ tự đó, không bỏ và không thêm cung nào.
- Với mỗi cung, mỗi sao trong cung đó một dòng: nói sao ấy có ý nghĩa gì KHI NẰM Ở ĐÚNG CUNG
  NÀY, dài 15 đến 25 từ, cụ thể và dễ hiểu, không viết chung chung kiểu cung nào cũng đúng.
- Coi vị trí Tràng Sinh như một mục nữa trong cùng danh sách đó.
- Rồi "tongQuan" cho cả cung: một đến hai câu, tối đa 40 từ.
- Ghi lại tên cung và tên sao đúng y như trên.
- Không viết con số điểm hay phần trăm. Những số đó đã hiển thị sẵn cạnh bài viết của bạn.`
  }

Trả về đúng một object JSON (return exactly one JSON object):
{
  "cung": [
    {
      "ten": "tên cung, đúng như đã liệt kê ở trên",
      "sao": [{ "ten": "tên sao hoặc vị trí Tràng Sinh", "y": "một câu về ý nghĩa của nó ở cung này" }],
      "tongQuan": "một đến hai câu tóm lại cả cung"
    }
  ]
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
 * Names the required sections a response failed to supply. Diagnosis only —
 * parseInterpretationSections stays all-or-nothing, so no caller can be tempted
 * to render a half-reading.
 */
export function missingRequiredSections(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null) return [...REQUIRED_SECTION_KEYS]
  const source = raw as Record<string, unknown>
  return REQUIRED_SECTION_KEYS.filter((key) => !isSection(source[key]))
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

export type PalaceStarNote = { name: string; text: string }
export type PalaceReading = { stars: PalaceStarNote[]; summary: string }

/**
 * Palace and star names come back as the model retyped them, so lookups go
 * through this: lower-cased, diacritics stripped, whitespace collapsed. Without
 * it a single missing tone mark loses a whole palace's reading.
 */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalizes a star name for matching between the chart and the model's text.
 *
 * On top of normalizeName it drops two things the model adds and the chart does
 * not: a trailing parenthetical, because it writes "Tả Phù (hóa Khoa)" where the
 * chart holds "Tả Phù" and carries the transform separately, and a leading
 * "Tràng Sinh:" label, because it writes "Tràng Sinh: Mộ" where the chart holds
 * "Mộ". Without this every transformed star and all twelve Tràng Sinh readings
 * fail to match and vanish without a trace.
 */
export function matchableStarName(value: string): string {
  return normalizeName(value.replace(/^\s*tràng sinh\s*:/iu, '').replace(/\([^)]*\)\s*$/u, ''))
}

/**
 * The per-palace readings, keyed by normalized palace name. Optional by design:
 * a response missing or mangling this block still leaves the eleven scored
 * sections usable, so one bad generation degrades the palace panel rather than
 * the whole page.
 */
export function parsePalaceReadings(raw: unknown): Record<string, PalaceReading> {
  if (typeof raw !== 'object' || raw === null) return {}
  const list = (raw as Record<string, unknown>).cung
  if (!Array.isArray(list)) return {}

  const palaces: Record<string, PalaceReading> = {}
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue
    const { ten, sao, tongQuan } = entry as Record<string, unknown>
    if (typeof ten !== 'string' || ten.trim() === '') continue

    const stars: PalaceStarNote[] = []
    if (Array.isArray(sao)) {
      for (const item of sao) {
        if (typeof item !== 'object' || item === null) continue
        const { ten: name, y: text } = item as Record<string, unknown>
        if (typeof name !== 'string' || name.trim() === '') continue
        if (typeof text !== 'string' || text.trim() === '') continue
        stars.push({ name: name.trim(), text: text.trim() })
      }
    }

    const summary = typeof tongQuan === 'string' ? tongQuan.trim() : ''
    // An entry with neither a star line nor a summary carries nothing; keeping it
    // would render an empty panel that looks like a loading failure.
    if (stars.length === 0 && summary === '') continue
    palaces[normalizeName(ten)] = { stars, summary }
  }
  return palaces
}

/**
 * The inverse of parsePalaceReadings: back to the list shape the model returns.
 *
 * Everything that carries palaces out of the route goes through this — the cache
 * record and the HTTP response alike — so both re-enter the app through the same
 * parser a fresh completion does. A response that shipped the keyed record
 * instead parsed as nothing at all on the client, and the panel reported a
 * generation failure for readings that had arrived intact.
 */
export function palaceReadingsToList(palaces: Record<string, PalaceReading>) {
  return Object.entries(palaces).map(([name, reading]) => ({
    ten: name,
    sao: reading.stars.map((star) => ({ ten: star.name, y: star.text })),
    tongQuan: reading.summary,
  }))
}

/**
 * Reads a stored palace reading only while it is still valid for this birth
 * data, this lunar day and the current palace prompt. Same identity rules the
 * sections cache uses, kept separate so a change to one prompt does not throw
 * away a perfectly good reading from the other.
 */
export function readCachedPalaces(
  stored: unknown,
  fingerprint: string,
): Record<string, PalaceReading> | null {
  if (typeof stored !== 'object' || stored === null) return null

  const record = stored as Record<string, unknown>
  // No date in the key at all, and that is not an oversight.
  //
  // `describePalaces` sends the palace name, its Can Chi, its stars, and Tuần/Triệt/Tràng
  // Sinh — every one of them a property of the natal chart. It sends no cycle: not Đại
  // vận, not Lưu niên, not Lưu nguyệt. So what a star means in the palace it landed in is
  // the same answer next month and next year as it is today. These readings expire only
  // when the birth data changes (fingerprint) or the prompt does (version).
  if (record.profileFingerprint !== fingerprint) return null
  if (record.version !== PALACE_VERSION) return null

  const palaces = parsePalaceReadings({ cung: record.palaces })
  // An empty map is not a hit: it would pin the panel to "no reading" for the
  // rest of the lunar day with no way to ask again.
  return Object.keys(palaces).length > 0 ? palaces : null
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
  lunarMonth: string,
): {
  sections: Record<string, ParsedSection>
  /**
   * False when the reading was written by an older prompt OR for an earlier lunar month.
   * Either way it is still returned, because a slightly old reading beats none.
   *
   * The month case is worth spelling out: of the eleven sections, exactly one — `vanHan` —
   * interprets the cycles, and even there only its Lưu nguyệt half goes out of date (Đại
   * vận and Lưu niên turn over yearly). The other ten describe the natal chart, which does
   * not move. Discarding all eleven to refresh one would be a bad trade, so the caller
   * serves what it has and offers a refresh.
   */
  current: boolean
} | null {
  if (typeof stored !== 'object' || stored === null) return null

  const record = stored as Record<string, unknown>
  // Fingerprint is the hard gate: a different birth date is a different person's chart and
  // must never be served. The month is soft — see the note on `current` above.
  if (record.profileFingerprint !== fingerprint) return null

  const sections = parseInterpretationSections(record.sections)
  if (!sections) return null
  return {
    sections,
    current: record.version === INTERPRETATION_VERSION && record.lunarMonth === lunarMonth,
  }
}
