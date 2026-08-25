// The Western (solar) zodiac sign, independent of the Vietnamese tử vi system
// — used only as a small extra label alongside nạp âm and the Chinese zodiac
// animal on the tu-vi overview page.

export type WesternZodiacSign =
  | 'Bạch Dương'
  | 'Kim Ngưu'
  | 'Song Tử'
  | 'Cự Giải'
  | 'Sư Tử'
  | 'Xử Nữ'
  | 'Thiên Bình'
  | 'Bọ Cạp'
  | 'Nhân Mã'
  | 'Ma Kết'
  | 'Bảo Bình'
  | 'Song Ngư'

/** Standard tropical zodiac date ranges, keyed off the solar month/day only. */
export function westernZodiacSign({ month: m, day: d }: { month: number; day: number }): WesternZodiacSign {
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return 'Bạch Dương'
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return 'Kim Ngưu'
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return 'Song Tử'
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return 'Cự Giải'
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return 'Sư Tử'
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return 'Xử Nữ'
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return 'Thiên Bình'
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return 'Bọ Cạp'
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return 'Nhân Mã'
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return 'Ma Kết'
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return 'Bảo Bình'
  return 'Song Ngư' // (m === 2 && d >= 19) || (m === 3 && d <= 20)
}
