export interface ScheduleQuery { teamId: string; sportCode: 'MSO' | 'WSO'; year: number }
export interface ParsedRecord { wins: number; losses: number; ties: number }

export async function fetchSchedule(q: ScheduleQuery): Promise<unknown | null> {
  const url = `https://data.ncaa.com/casablanca/schedule/${q.sportCode.toLowerCase()}/${q.year}/${q.teamId}/schedule.json`
  const res = await fetch(url)
  if (!res.ok) return null
  return await res.json()
}

export function parseSeasonRecord(payload: unknown): ParsedRecord {
  const games = (payload as any)?.games ?? []
  let wins = 0, losses = 0, ties = 0
  for (const g of games) {
    if (g.gameStatus !== 'final') continue
    const w = g.result?.W
    if (w === 'W') wins++
    else if (w === 'L') losses++
    else if (w === 'T') ties++
  }
  return { wins, losses, ties }
}
