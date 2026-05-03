import { describe, it, expect } from 'vitest'
import { extractTourneyAppearances } from './wikipediaTourney'

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
