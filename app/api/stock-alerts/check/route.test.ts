import { describe, it, expect } from 'vitest'
import { alertArrow, alertTeamsColor, formatPct, formatVNPrice } from './utils'

describe('formatVNPrice', () => {
  it('formats large integers with vi-VN dot grouping', () => {
    expect(formatVNPrice(1234567)).toBe('1.234.567')
  })
  it('handles five-digit price', () => {
    expect(formatVNPrice(12500)).toBe('12.500')
  })
  it('handles zero', () => {
    expect(formatVNPrice(0)).toBe('0')
  })
})

describe('alertArrow', () => {
  it('returns ▲ for rise', () => expect(alertArrow('rise')).toBe('▲'))
  it('returns ▼ for fall', () => expect(alertArrow('fall')).toBe('▼'))
})

describe('alertTeamsColor', () => {
  it('returns Good for rise', () => expect(alertTeamsColor('rise')).toBe('Good'))
  it('returns Attention for fall', () => expect(alertTeamsColor('fall')).toBe('Attention'))
})

describe('formatPct', () => {
  it('formats positive change to 2 decimals', () => expect(formatPct(5.678)).toBe('5.68'))
  it('strips sign from negative change', () => expect(formatPct(-3.4)).toBe('3.40'))
  it('handles zero', () => expect(formatPct(0)).toBe('0.00'))
})
