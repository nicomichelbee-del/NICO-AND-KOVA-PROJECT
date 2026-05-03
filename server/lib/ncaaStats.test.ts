import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSchedule, parseSeasonRecord } from './ncaaStats'

describe('parseSeasonRecord', () => {
  it('counts wins, losses, ties from a schedule payload', () => {
    const payload = {
      games: [
        { result: { W: 'W' }, opponent: { score: 1 }, score: 2, gameStatus: 'final' },
        { result: { W: 'L' }, opponent: { score: 3 }, score: 1, gameStatus: 'final' },
        { result: { W: 'T' }, opponent: { score: 1 }, score: 1, gameStatus: 'final' },
        { result: { W: 'W' }, opponent: { score: 0 }, score: 4, gameStatus: 'final' },
      ],
    }
    const r = parseSeasonRecord(payload)
    expect(r.wins).toBe(2)
    expect(r.losses).toBe(1)
    expect(r.ties).toBe(1)
  })

  it('ignores in-progress games', () => {
    const payload = {
      games: [
        { result: { W: 'W' }, gameStatus: 'final' },
        { result: null, gameStatus: 'live' },
      ],
    }
    const r = parseSeasonRecord(payload)
    expect(r.wins).toBe(1)
    expect(r.losses).toBe(0)
    expect(r.ties).toBe(0)
  })
})

describe('fetchSchedule', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns null on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const r = await fetchSchedule({ teamId: 'NOPE', sportCode: 'MSO', year: 2024 })
    expect(r).toBeNull()
  })

  it('returns the JSON payload on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ games: [] }) }))
    const r = await fetchSchedule({ teamId: '1234', sportCode: 'MSO', year: 2024 })
    expect(r).toEqual({ games: [] })
  })
})
