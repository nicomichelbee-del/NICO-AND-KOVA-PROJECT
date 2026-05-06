import { describe, it, expect } from 'vitest'
import { isCoachEmail, decodeMessageBody, selectContactsToAutoRate, AUTO_RATE_CAP } from './gmailUtils'

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
    const data = Buffer.from('Hello coach', 'utf-8').toString('base64url')
    const payload = {
      parts: [{ mimeType: 'text/plain', body: { data } }],
    }
    expect(decodeMessageBody(payload)).toBe('Hello coach')
  })

  it('decodes top-level body data', () => {
    const data = Buffer.from('Direct body', 'utf-8').toString('base64url')
    const payload = { body: { data } }
    expect(decodeMessageBody(payload)).toBe('Direct body')
  })

  it('returns empty string for null payload', () => {
    expect(decodeMessageBody(null)).toBe('')
  })

  it('strips HTML tags when only text/html part exists', () => {
    const data = Buffer.from('<p>Hello</p>', 'utf-8').toString('base64url')
    const payload = {
      parts: [{ mimeType: 'text/html', body: { data } }],
    }
    expect(decodeMessageBody(payload)).toBe('Hello')
  })

  it('finds text/plain nested inside multipart/alternative', () => {
    const data = Buffer.from('Plain coach reply', 'utf-8').toString('base64url')
    const htmlData = Buffer.from('<div>HTML version</div>', 'utf-8').toString('base64url')
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data } },
            { mimeType: 'text/html', body: { data: htmlData } },
          ],
        },
      ],
    }
    expect(decodeMessageBody(payload)).toBe('Plain coach reply')
  })

  it('strips nested HTML when no text/plain exists at any depth', () => {
    const html = '<style>.gs{color:red}</style><div class="gs" style="margin:0">Hi <b>Nicolas</b>,&nbsp;welcome.</div>'
    const data = Buffer.from(html, 'utf-8').toString('base64url')
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [{ mimeType: 'text/html', body: { data } }],
        },
      ],
    }
    expect(decodeMessageBody(payload)).toBe('Hi Nicolas, welcome.')
  })

  it('decodes HTML entities and drops style blocks', () => {
    const html = '<style>p{display:block}</style><p>Travis &amp; coach said &quot;hi&quot;</p>'
    const data = Buffer.from(html, 'utf-8').toString('base64url')
    const payload = { parts: [{ mimeType: 'text/html', body: { data } }] }
    expect(decodeMessageBody(payload)).toBe('Travis & coach said "hi"')
  })
})

// These tests pin the token-leak guarantees of the sync auto-rate batch.
// If they break, real money is on the line — every excluded edge represents
// either a duplicate Claude call or an unbounded loop.
describe('selectContactsToAutoRate', () => {
  it('excludes contacts that already have a non-pending rating', () => {
    const contacts = [
      { id: 'a', interestRating: 'hot', lastReplySnippet: 'real reply' },
      { id: 'b', interestRating: 'warm', lastReplySnippet: 'real reply' },
      { id: 'c', interestRating: 'cold', lastReplySnippet: 'real reply' },
      { id: 'd', interestRating: 'not_interested', lastReplySnippet: 'real reply' },
      { id: 'e', interestRating: 'pending', lastReplySnippet: 'real reply' },
    ]
    const out = selectContactsToAutoRate(contacts)
    expect(out.map((c) => c.id)).toEqual(['e'])
  })

  it('excludes contacts with no reply snippet', () => {
    const contacts = [
      { id: 'a', interestRating: 'pending', lastReplySnippet: '' },
      { id: 'b', interestRating: 'pending', lastReplySnippet: null },
      { id: 'c', interestRating: 'pending', lastReplySnippet: undefined },
      { id: 'd', interestRating: 'pending', lastReplySnippet: '   ' },
      { id: 'e', interestRating: 'pending', lastReplySnippet: 'Hi Nicolas, thanks for' },
    ]
    const out = selectContactsToAutoRate(contacts)
    expect(out.map((c) => c.id)).toEqual(['e'])
  })

  it('caps at AUTO_RATE_CAP — extras roll to the next sync', () => {
    const contacts = Array.from({ length: 50 }, (_, i) => ({
      id: `c${i}`, interestRating: 'pending', lastReplySnippet: 'reply',
    }))
    const out = selectContactsToAutoRate(contacts)
    expect(out.length).toBe(AUTO_RATE_CAP)
    expect(AUTO_RATE_CAP).toBeLessThanOrEqual(20)
  })

  it('returns empty for an empty input — never spawns a zero-email Claude call', () => {
    expect(selectContactsToAutoRate([])).toEqual([])
  })

  it('respects a custom cap (e.g. for tests / future tuning)', () => {
    const contacts = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`, interestRating: 'pending', lastReplySnippet: 'reply',
    }))
    expect(selectContactsToAutoRate(contacts, 3).length).toBe(3)
  })

  it('idempotent under repeated sync — once rated, never re-rated', () => {
    // First sync: contact has reply, pending rating → selected
    const beforeFirstSync = [{ id: 'a', interestRating: 'pending', lastReplySnippet: 'hi' }]
    expect(selectContactsToAutoRate(beforeFirstSync).length).toBe(1)
    // After sync persists rating → contact moves to non-pending
    const afterFirstSync = [{ id: 'a', interestRating: 'warm', lastReplySnippet: 'hi' }]
    expect(selectContactsToAutoRate(afterFirstSync).length).toBe(0)
  })
})
