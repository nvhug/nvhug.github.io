import { describe, expect, it } from 'vitest'
import { splitReadingParagraphs } from './prose'

describe('splitReadingParagraphs', () => {
  it('groups sentences two to a paragraph', () => {
    const text = 'Câu một. Câu hai. Câu ba. Câu bốn.'
    expect(splitReadingParagraphs(text)).toEqual(['Câu một. Câu hai.', 'Câu ba. Câu bốn.'])
  })

  it('leaves an odd trailing sentence as its own paragraph', () => {
    expect(splitReadingParagraphs('Một. Hai. Ba.')).toEqual(['Một. Hai.', 'Ba.'])
  })

  it('returns one entry when there is no sentence boundary', () => {
    expect(splitReadingParagraphs('Chỉ một câu duy nhất.')).toEqual(['Chỉ một câu duy nhất.'])
  })

  it('does not split a decimal — the real reading text that motivated this', () => {
    // A dot followed by a digit is not a boundary, so "-1.5" stays intact.
    const text =
      'Tổng gốc -3, có Tuần nên chia đôi còn -1.5, đạt 46%. Bạn có khả năng kiếm tiền nhưng khó giữ.'
    expect(splitReadingParagraphs(text)).toEqual([text])
  })

  it('splits on a Vietnamese capital with diacritics', () => {
    expect(splitReadingParagraphs('Một. Đà La là hung tinh. Ba. Bốn.')).toEqual([
      'Một. Đà La là hung tinh.',
      'Ba. Bốn.',
    ])
  })

  it('splits after a question mark or exclamation mark', () => {
    expect(splitReadingParagraphs('Vì sao vậy? Vì Tuần chia đôi điểm. Cần tiết chế!')).toEqual([
      'Vì sao vậy? Vì Tuần chia đôi điểm.',
      'Cần tiết chế!',
    ])
  })

  it('drops surrounding and repeated whitespace', () => {
    expect(splitReadingParagraphs('  Một.   Hai.  ')).toEqual(['Một. Hai.'])
  })

  it('returns an empty list for blank text', () => {
    expect(splitReadingParagraphs('')).toEqual([])
    expect(splitReadingParagraphs('   ')).toEqual([])
  })
})
