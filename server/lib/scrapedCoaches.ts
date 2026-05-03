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
  status:     'success' | 'no-program' | 'failed' | 'partial' | 'ai-inferred' | 'email-inferred' | 'web-verified' | 'web-name-only'
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
const MANUAL_PATH = path.join(__dirname, '..', 'data', 'coachesManual.json')

interface FlatCache {
  byId:   Record<string, ScrapedCoach>
  byName: Record<string, ScrapedCoach>
  mtime:  number
}

let flatCache: FlatCache | null = null
let manualCache: FlatCache | null = null

function readFlatFile(filePath: string): FlatCache {
  const mtime = fs.statSync(filePath).mtimeMs
  const raw: Record<string, ScrapedCoach | { _README?: string }> =
    JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const byId: Record<string, ScrapedCoach> = {}
  const byName: Record<string, ScrapedCoach> = {}
  for (const [key, entry] of Object.entries(raw)) {
    // Skip metadata keys (e.g. _README in coachesManual.json)
    if (key.startsWith('_')) continue
    const e = entry as ScrapedCoach
    if (!e || !e.schoolId || !e.gender) continue
    byId[key] = e
    if (e.schoolName) byName[`${e.schoolName.toLowerCase()}:${e.gender}`] = e
  }
  return { byId, byName, mtime }
}

function loadFlat(): FlatCache {
  try {
    const mtime = fs.statSync(CACHE_PATH).mtimeMs
    if (flatCache && mtime === flatCache.mtime) return flatCache
    flatCache = readFlatFile(CACHE_PATH)
    return flatCache
  } catch {
    return { byId: {}, byName: {}, mtime: 0 }
  }
}

function loadManual(): FlatCache {
  try {
    const mtime = fs.statSync(MANUAL_PATH).mtimeMs
    if (manualCache && mtime === manualCache.mtime) return manualCache
    manualCache = readFlatFile(MANUAL_PATH)
    return manualCache
  } catch {
    return { byId: {}, byName: {}, mtime: 0 }
  }
}

function getFromCache(cache: FlatCache, schoolNameOrId: string, gender: 'mens' | 'womens'): ScrapedCoach | null {
  return cache.byId[`${schoolNameOrId}:${gender}`]
    ?? cache.byName[`${schoolNameOrId.toLowerCase()}:${gender}`]
    ?? null
}

function getFromManual(schoolNameOrId: string, gender: 'mens' | 'womens'): ScrapedCoach | null {
  const entry = getFromCache(loadManual(), schoolNameOrId, gender)
  if (!entry) return null
  // Force status to 'success' so callers don't gate on it. Manual entries are
  // the most-trusted source in the system.
  return { ...entry, status: 'success' }
}

function getFromFlat(schoolNameOrId: string, gender: 'mens' | 'womens'): ScrapedCoach | null {
  return getFromCache(loadFlat(), schoolNameOrId, gender)
}

// ── Public API ────────────────────────────────────────────────────────────

// Statuses that are worth returning to callers. Failed/unknown entries
// fall through to AI-recall in the route handler.
// `email-inferred` = real scraped coach name + Haiku-inferred email format.
// The route handler badges these as "verify before sending" so the user knows.
const USEFUL_STATUSES = ['success', 'partial', 'ai-inferred', 'email-inferred', 'web-verified', 'web-name-only']

export async function getScrapedCoach(
  schoolNameOrId: string,
  gender: 'mens' | 'womens',
): Promise<ScrapedCoach | null> {
  // Manual overrides take precedence over Supabase and the scraped flat file.
  // These are hand-verified entries for high-priority schools where automation
  // failed; humans always beat the scraper.
  const manual = getFromManual(schoolNameOrId, gender)
  if (manual) return manual

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
  manualCache = null
}
