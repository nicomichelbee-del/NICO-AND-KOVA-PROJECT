import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

export interface ScrapedCoach {
  schoolId:   string
  schoolName: string
  gender:     'mens' | 'womens'
  coachName:  string
  coachTitle: string
  coachEmail: string
  sourceUrl:  string
  scrapedAt:  string
  status:     'success' | 'no-program' | 'failed' | 'partial' | 'ai-inferred'
  reason?:    string
}

// ── Supabase DB row shape ─────────────────────────────────────────────────

interface CoachRow {
  school_id:  string
  gender:     'mens' | 'womens'
  name:       string
  title:      string
  email:      string
  source_url: string
  scraped_at: string | null
  status:     string
  schools:    { name: string } | null
}

function rowToCoach(row: CoachRow): ScrapedCoach {
  return {
    schoolId:   row.school_id,
    schoolName: row.schools?.name ?? row.school_id,
    gender:     row.gender,
    coachName:  row.name,
    coachTitle: row.title,
    coachEmail: row.email,
    sourceUrl:  row.source_url,
    scrapedAt:  row.scraped_at ?? '',
    status:     row.status as ScrapedCoach['status'],
  }
}

// ── Supabase client ────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || url.includes('placeholder') || !key || key.includes('placeholder')) return null
  return createClient(url, key)
}

// ── JSON flat-file fallback (dev / offline) ───────────────────────────────

const CACHE_PATH = path.join(__dirname, '..', 'data', 'coachesScraped.json')

interface FlatCache {
  byId:   Record<string, ScrapedCoach>
  byName: Record<string, ScrapedCoach>
  mtime:  number
}

let flatCache: FlatCache | null = null

function loadFlat(): FlatCache {
  try {
    const mtime = fs.statSync(CACHE_PATH).mtimeMs
    if (flatCache && mtime === flatCache.mtime) return flatCache
    const byId: Record<string, ScrapedCoach> = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
    const byName: Record<string, ScrapedCoach> = {}
    for (const entry of Object.values(byId)) {
      byName[`${entry.schoolName.toLowerCase()}:${entry.gender}`] = entry
    }
    flatCache = { byId, byName, mtime }
    return flatCache
  } catch {
    return { byId: {}, byName: {}, mtime: 0 }
  }
}

function getFromFlat(schoolNameOrId: string, gender: 'mens' | 'womens'): ScrapedCoach | null {
  const { byId, byName } = loadFlat()
  return byId[`${schoolNameOrId}:${gender}`]
    ?? byName[`${schoolNameOrId.toLowerCase()}:${gender}`]
    ?? null
}

// ── Public API ────────────────────────────────────────────────────────────

// Statuses that are worth returning to callers. Failed/unknown entries
// fall through to AI-recall in the route handler.
const USEFUL_STATUSES = ['success', 'partial', 'ai-inferred']

export async function getScrapedCoach(
  schoolNameOrId: string,
  gender: 'mens' | 'womens',
): Promise<ScrapedCoach | null> {
  const supabase = getSupabase()

  if (supabase) {
    // Try exact school_id match first, then join on school name
    const { data, error } = await supabase
      .from('coaches')
      .select('school_id, gender, name, title, email, source_url, scraped_at, status, schools(name)')
      .or(`school_id.eq.${schoolNameOrId},schools.name.ilike.${schoolNameOrId}`)
      .eq('gender', gender)
      .in('status', USEFUL_STATUSES)
      .limit(1)
      .single()

    if (!error && data) return rowToCoach(data as unknown as CoachRow)

    // Supabase configured but no row found — fall through to flat file
    // (pre-seed dev state) rather than returning null immediately.
  }

  const entry = getFromFlat(schoolNameOrId, gender)
  if (!entry || !USEFUL_STATUSES.includes(entry.status)) return null
  return entry
}

export function _resetMemo() {
  flatCache = null
}
