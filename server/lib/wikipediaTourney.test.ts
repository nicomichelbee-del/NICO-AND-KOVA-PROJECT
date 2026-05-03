import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractTourneyAppearances, resolveWikipediaTitle } from './wikipediaTourney'

describe('extractTourneyAppearances', () => {
  it('extracts a year-to-round mapping from a wikitext blob', () => {
    const wikitext = `== NCAA Tournament results ==
{| class="wikitable"
! Year !! Round
|-
| 2022 || First Round
|-
| 2023 || Final Four
|-
| 2024 || Champion
|}`
    const r = extractTourneyAppearances(wikitext)
    expect(r[2022]).toBe('First Round')
    expect(r[2023]).toBe('Final Four')
    expect(r[2024]).toBe('Champion')
  })

  it('returns empty object when no tourney section', () => {
    expect(extractTourneyAppearances('Some other content')).toEqual({})
  })
})

describe('resolveWikipediaTitle', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns the first match title when opensearch returns one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ['UNC men', ['North Carolina Tar Heels men\'s soccer'], [''], ['']],
    }))
    const r = await resolveWikipediaTitle('UNC men')
    expect(r).toBe("North Carolina Tar Heels men's soccer")
  })

  it('returns null when opensearch has no matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ['x', [], [], []] }))
    expect(await resolveWikipediaTitle('asdf')).toBeNull()
  })
})
