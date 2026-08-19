import { describe, expect, it } from 'vitest'
import { governanceDisclosuresFromVietstock } from './governanceDisclosures'

describe('Vietstock governance disclosures', () => {
  it('keeps only governance-relevant documents with a traceable source URL', () => {
    const result = governanceDisclosuresFromVietstock([
      { Title: 'Nghị quyết HĐQT số 10/2026', Url: 'https://static2.vietstock.vn/board.pdf', LastUpdate: '/Date(1787016067350)/' },
      { Title: 'Thông báo lãi suất tiền gửi', Url: 'https://static2.vietstock.vn/rate.pdf' },
    ])

    expect(result).toEqual({
      source: 'Vietstock',
      documents: [{ title: 'Nghị quyết HĐQT số 10/2026', url: 'https://static2.vietstock.vn/board.pdf', publishedAt: '2026-08-18T01:21:07.350Z' }],
    })
  })
})