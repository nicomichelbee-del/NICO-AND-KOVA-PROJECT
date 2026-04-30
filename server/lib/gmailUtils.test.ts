import { describe, it, expect } from 'vitest'
import { isCoachEmail, decodeMessageBody } from './gmailUtils'

describe('isCoachEmail', () => {
  it('returns true for .edu sender', () => {
    expect(isCoachEmail('coach@unc.edu', 'Hello')).toBe(true)
  })

  it('returns true when subject contains recruiting keyword', () => {
    expect(isCoachEmail('person@gmail.com', 'Soccer recruiting inquiry')).toBe(true)
  })

  it('returns true for scholarship mention in subject', () => {
    expect(isCoachEmail('staff@example.com', 'Scholarship opportunity for you')).toBe(true)
  })

  it('returns false for unrelated email', () => {
    expect(isCoachEmail('newsletter@amazon.com', 'Your order has shipped')).toBe(false)
  })

  it('is case-insensitive on subject', () => {
    expect(isCoachEmail('person@gmail.com', 'SOCCER CAMP INVITE')).toBe(true)
  })
})

describe('decodeMessageBody', () => {
  it('decodes base64 text/plain part', () => {
    const data = Buffer.from('Hello coach', 'utf-8').toString('base64')
    const payload = {
      parts: [{ mimeType: 'text/plain', body: { data } }],
    }
    expect(decodeMessageBody(payload)).toBe('Hello coach')
  })

  it('decodes top-level body data', () => {
    const data = Buffer.from('Direct body', 'utf-8').toString('base64')
    const payload = { body: { data } }
    expect(decodeMessageBody(payload)).toBe('Direct body')
  })

  it('returns empty string for null payload', () => {
    expect(decodeMessageBody(null)).toBe('')
  })

  it('strips HTML tags when only text/html part exists', () => {
    const data = Buffer.from('<p>Hello</p>', 'utf-8').toString('base64')
    const payload = {
      parts: [{ mimeType: 'text/html', body: { data } }],
    }
    expect(decodeMessageBody(payload)).toBe('Hello')
  })
})
