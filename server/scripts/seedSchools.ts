/**
 * Seed the `schools` and `coaches` Supabase tables from local JSON files.
 *
 * Sources:
 *   server/data/schools.json        → schools table
 *   server/data/coachesScraped.json → coaches table (merged)
 *
 * Usage:
 *   npx tsx server/scripts/seedSchools.ts
 *   npx tsx server/scripts/seedSchools.ts --dry-run    # preview counts only
 *
 * Requires in .env:
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_KEY=eyJ...   (service_role key — never the anon key)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const DRY_RUN = process.argv.includes('--dry-run')

// ── Supabase admin client ────────────────────────────────────────────────────

const url = process.env.VITE_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? ''

if (!DRY_RUN) {
  if (!url || url === 'https://placeholder.supabase.co') {
    console.error('❌  VITE_SUPABASE_URL is not set or is still a placeholder.')
    console.error('    Add your real Supabase project URL to .env and retry.')
    process.exit(1)
  }
  if (!serviceKey || serviceKey.startsWith('placeholder')) {
    console.error('❌  SUPABASE_SERVICE_KEY is not set.')
    console.error('    Go to: Supabase Dashboard → Project Settings → API → service_role key')
    console.error('    Add it to .env as SUPABASE_SERVICE_KEY=eyJ...')
    process.exit(1)
  }
}

const supabase = DRY_RUN
  ? null
  : createClient(url, serviceKey, { auth: { persistSession: false } })

// ── Load source data ─────────────────────────────────────────────────────────

interface SchoolJSON {
  id: string
  name: string
  division: string
  conference: string
  location: string
  region: string
  enrollment: number
  size: string
  gpaMin: number
  gpaAvg: number
  goalsForwardAvg: number
  goalsMidAvg: number
  programStrength: number
  scholarships: boolean
  notes: string
}

interface ScrapedCoach {
  schoolId: string
  schoolName: string
  gender: 'mens' | 'womens'
  coachName: string
  coachTitle: string
  coachEmail: string
  sourceUrl: string
  scrapedAt: string
  status: 'success' | 'partial' | 'failed' | 'no-program'
  reason?: string
}

const schoolsRaw: SchoolJSON[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'schools.json'), 'utf8'),
)

const scrapedRaw: Record<string, ScrapedCoach> = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'coachesScraped.json'), 'utf8'),
)

// ── Shape schools rows ────────────────────────────────────────────────────────

const schoolRows = schoolsRaw.map((s) => ({
  id:                s.id,
  name:              s.name,
  division:          s.division,
  conference:        s.conference ?? '',
  location:          s.location ?? '',
  region:            s.region ?? '',
  enrollment:        s.enrollment ?? null,
  size:              s.size ?? null,
  gpa_min:           s.gpaMin ?? null,
  gpa_avg:           s.gpaAvg ?? null,
  goals_forward_avg: s.goalsForwardAvg ?? null,
  goals_mid_avg:     s.goalsMidAvg ?? null,
  program_strength:  s.programStrength ?? null,
  scholarships:      s.scholarships ?? false,
  notes:             s.notes ?? '',
}))

// ── Shape coaches rows ───────────────────────────────────────────────────────

// Build a set of valid school IDs so we don't insert orphaned coach rows.
const validSchoolIds = new Set(schoolRows.map((s) => s.id))

const coachRows: {
  school_id:  string
  gender:     'mens' | 'womens'
  name:       string
  title:      string
  email:      string
  source_url: string
  scraped_at: string | null
  status:     string
}[] = []

for (const [key, entry] of Object.entries(scrapedRaw)) {
  const { schoolId, gender, coachName, coachTitle, coachEmail, sourceUrl, scrapedAt, status } = entry

  // Skip if the school isn't in our reference list.
  if (!validSchoolIds.has(schoolId)) continue

  // Only persist entries that have at least a name.
  // Failed entries with no data are still recorded as 'failed' so we know
  // which programs haven't been successfully scraped yet.
  coachRows.push({
    school_id:  schoolId,
    gender,
    name:       coachName ?? '',
    title:      coachTitle ?? '',
    email:      coachEmail ?? '',
    source_url: sourceUrl ?? '',
    scraped_at: scrapedAt ?? null,
    status:     status === 'no-program' ? 'failed' : status,
  })
}

// ── Stats preview ─────────────────────────────────────────────────────────────

const statusCounts: Record<string, number> = {}
for (const r of coachRows) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
const withEmailCount = coachRows.filter((r) => r.email).length
const withNameCount = coachRows.filter((r) => r.name).length

console.log('══ SEED PREVIEW ══')
console.log(`Schools to upsert:     ${schoolRows.length}`)
console.log(`Coach rows to upsert:  ${coachRows.length}`)
console.log(`  with name:    ${withNameCount} (${Math.round(withNameCount / coachRows.length * 100)}%)`)
console.log(`  with email:   ${withEmailCount} (${Math.round(withEmailCount / coachRows.length * 100)}%)`)
console.log(`  by status:`)
Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`    ${k.padEnd(18)} ${v}`)
})
console.log()

if (DRY_RUN) {
  console.log('Dry run — no writes performed.')
  process.exit(0)
}

// ── Upsert in batches ────────────────────────────────────────────────────────

const BATCH = 100

async function upsertBatches<T extends object>(
  table: string,
  rows: T[],
  conflictCol: string,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase!
      .from(table)
      .upsert(batch, { onConflict: conflictCol })
    if (error) {
      console.error(`❌  Error upserting ${table} batch ${i / BATCH + 1}:`, error.message)
      throw error
    }
    process.stdout.write(`\r  ${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length} upserted`)
  }
  console.log()
}

async function main() {
  console.log('Seeding schools...')
  await upsertBatches('schools', schoolRows, 'id')

  console.log('Seeding coaches...')
  // coaches has a unique constraint on (school_id, gender)
  await upsertBatches('coaches', coachRows, 'school_id,gender')

  console.log()
  console.log('══ DONE ══')
  console.log(`✅  ${schoolRows.length} schools seeded`)
  console.log(`✅  ${coachRows.length} coach rows seeded`)
  console.log()
  console.log('Next steps:')
  console.log('  • Run the scraper to improve partial/failed coach entries:')
  console.log('    npx tsx server/scripts/scrapeCoaches.ts --resume')
  console.log('  • After re-scraping, run this seed script again to sync:')
  console.log('    npx tsx server/scripts/seedSchools.ts')
}

main().catch((e) => {
  console.error('SEED FAILED:', e)
  process.exit(1)
})
