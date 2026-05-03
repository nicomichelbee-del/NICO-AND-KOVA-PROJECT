/**
 * Competitive record scraper — D1/D2/D3 men's & women's soccer.
 * Cost: $0 (NCAA public feed + Wikipedia). No Claude API.
 *
 * First run resolves NCAA team IDs and caches them at server/data/ncaaTeamIds.json.
 * Subsequent runs reuse the cache.
 *
 * Usage:
 *   npx tsx server/scripts/scrapeRecord.ts --limit=20
 *   npx tsx server/scripts/scrapeRecord.ts --school=unc
 *   npx tsx server/scripts/scrapeRecord.ts --resume        # skip fresh entries
 */
import * as fs from 'fs'
import * as path from 'path'
import { fetchSchedule, parseSeasonRecord } from '../lib/ncaaStats'
import { fetchWikipediaWikitext, extractTourneyAppearances } from '../lib/wikipediaTourney'
import { tagField, isFresh } from '../lib/scraperConfidence'
import type { ProgramRecord, SeasonRecord } from '../../client/src/types/athletic'

const SCHOOLS_PATH = path.join(__dirname, '..', 'data', 'schools.json')
const RECORDS_PATH = path.join(__dirname, '..', 'data', 'programRecords.json')
const TEAMID_PATH  = path.join(__dirname, '..', 'data', 'ncaaTeamIds.json')

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']
}))
const ARG_LIMIT  = args.limit ? parseInt(args.limit, 10) : Infinity
const ARG_SCHOOL = args.school as string | undefined
const ARG_RESUME = args.resume === 'true'
const FRESHNESS_DAYS = 180
const SEASONS_TO_PULL = [2024, 2023, 2022]

interface School { id: string; name: string; division: string }

function loadJson<T>(p: string, fallback: T): T {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback
}

async function resolveTeamId(
  cache: Record<string, { mens?: string; womens?: string }>,
  schoolId: string,
  schoolName: string,
  gender: 'mens' | 'womens',
): Promise<string | null> {
  if (cache[schoolId]?.[gender]) return cache[schoolId][gender]!
  // Public NCAA team search endpoint, returns JSON matches.
  const url = `https://stats.ncaa.org/team/inst_team_list?sport_code=${gender === 'mens' ? 'MSO' : 'WSO'}&search=${encodeURIComponent(schoolName)}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'KickrIo/1.0 (info@fahga.org)' } })
    if (!res.ok) return null
    const html = await res.text()
    const m = html.match(/\/team\/(\d+)\//)
    if (!m) return null
    cache[schoolId] = { ...cache[schoolId], [gender]: m[1] }
    fs.writeFileSync(TEAMID_PATH, JSON.stringify(cache, null, 2))
    return m[1]
  } catch {
    return null
  }
}

async function buildRecord(school: School, gender: 'mens' | 'womens', teamIdCache: Record<string, any>): Promise<ProgramRecord | null> {
  const teamId = await resolveTeamId(teamIdCache, school.id, school.name, gender)
  const wikitext = await fetchWikipediaWikitext(`${school.name} ${gender === 'mens' ? "men's" : "women's"} soccer`)
  const tourney = wikitext ? extractTourneyAppearances(wikitext) : {}

  const seasons: SeasonRecord[] = []
  if (teamId) {
    for (const year of SEASONS_TO_PULL) {
      const sched = await fetchSchedule({ teamId, sportCode: gender === 'mens' ? 'MSO' : 'WSO', year })
      if (!sched) continue
      const parsed = parseSeasonRecord(sched)
      seasons.push({
        season: year,
        wins: parsed.wins,
        losses: parsed.losses,
        ties: parsed.ties,
        conferenceRecord: null,
        ncaaTourneyRound: tourney[year] ?? null,
      })
    }
  }

  if (seasons.length === 0 && Object.keys(tourney).length === 0) return null

  const source = teamId && wikitext ? 'mixed' : teamId ? 'ncaa-api' : 'wikipedia'
  const confidence = seasons.length >= 2 ? 'high' : seasons.length === 1 ? 'medium' : 'low'

  return tagField(
    { schoolId: school.id, gender, recordHistory: seasons },
    source,
    confidence,
  ) as ProgramRecord
}

async function main() {
  const schools = (loadJson<School[]>(SCHOOLS_PATH, [])).filter(s => ['D1','D2','D3'].includes(s.division))
  const filtered = ARG_SCHOOL ? schools.filter(s => s.id === ARG_SCHOOL) : schools
  const records = loadJson<Record<string, ProgramRecord>>(RECORDS_PATH, {})
  const teamIds = loadJson<Record<string, any>>(TEAMID_PATH, {})

  const queue: Array<{ school: School; gender: 'mens' | 'womens' }> = []
  for (const s of filtered) {
    for (const g of ['mens', 'womens'] as const) {
      const key = `${s.id}:${g}`
      if (ARG_RESUME && records[key] && isFresh(records[key].lastVerified, FRESHNESS_DAYS)) continue
      queue.push({ school: s, gender: g })
    }
  }
  const limited = queue.slice(0, ARG_LIMIT)
  console.log(`Targets: ${limited.length}`)

  let ok = 0, miss = 0, counter = 0
  for (const { school, gender } of limited) {
    counter++
    const rec = await buildRecord(school, gender, teamIds)
    if (rec) { records[`${school.id}:${gender}`] = rec; ok++ }
    else miss++
    const tag = rec ? '✅' : '❌'
    console.log(`[${counter}/${limited.length}] ${tag} ${school.id}:${gender}`)
    if (counter % 20 === 0) fs.writeFileSync(RECORDS_PATH, JSON.stringify(records, null, 2))
    await new Promise(r => setTimeout(r, 250)) // be nice to NCAA + Wikipedia
  }
  fs.writeFileSync(RECORDS_PATH, JSON.stringify(records, null, 2))
  console.log(`\nDone — ok:${ok} miss:${miss}`)
}

main().catch(e => { console.error('CRASHED:', e); process.exit(1) })
