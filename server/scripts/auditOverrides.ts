/**
 * auditOverrides.ts — read-only audit of noProgramOverrides.json
 *
 * For each override entry, simulate hasProgramOfGender() with the override
 * DISABLED and report what would happen. This tells us which overrides are
 * redundant (Wikipedia or AI verification already says no-program) vs.
 * load-bearing (the override is the ONLY signal preventing a false positive).
 *
 * Output:
 *   - Redundant: matcher would already return false without the override
 *   - Load-bearing: matcher would return true without the override
 *
 * Run:
 *   npx tsx server/scripts/auditOverrides.ts
 *
 * The script does NOT modify the override file. Use the output to decide
 * whether to manually trim redundant entries (cosmetic, no behavior change)
 * or leave them as belt-and-suspenders safety nets.
 */

import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '..', 'data')
const OVERRIDE_PATH    = path.join(DATA_DIR, 'noProgramOverrides.json')
const EADA_PATH        = path.join(DATA_DIR, 'eadaPrograms.json')
const SPONSORED_PATH   = path.join(DATA_DIR, 'sponsoredPrograms.json')
const VERIFICATION_PATH = path.join(DATA_DIR, 'programVerifications.json')
const COACHES_PATH     = path.join(DATA_DIR, 'coachesScraped.json')

interface VerificationEntry { hasProgram: boolean; confidence: 'high' | 'medium' | 'low' }
interface CoachEntry { status: string }

const overrides    = JSON.parse(fs.readFileSync(OVERRIDE_PATH, 'utf8')) as Record<string, unknown>
const eada         = JSON.parse(fs.readFileSync(EADA_PATH, 'utf8')) as Record<string, unknown>
const sponsored    = JSON.parse(fs.readFileSync(SPONSORED_PATH, 'utf8')) as Record<string, unknown>
const verification = JSON.parse(fs.readFileSync(VERIFICATION_PATH, 'utf8')) as Record<string, unknown>
const coaches      = JSON.parse(fs.readFileSync(COACHES_PATH, 'utf8')) as Record<string, CoachEntry>

// Mirror schoolMatcher.hasProgramOfGender's logic minus the override step.
function hasProgramWithoutOverride(key: string): { result: boolean; via: string } {
  // EADA — federal source of truth, highest authority below override
  const e = eada[key]
  if (e === true)  return { result: true,  via: 'EADA=true' }
  if (e === false) return { result: false, via: 'EADA=false' }
  // AI verification (high or medium confidence)
  const v = verification[key]
  if (v && typeof v === 'object'
      && typeof (v as VerificationEntry).hasProgram === 'boolean'
      && typeof (v as VerificationEntry).confidence === 'string'
      && (v as VerificationEntry).confidence !== 'low') {
    const ve = v as VerificationEntry
    return { result: ve.hasProgram, via: `AI ${ve.confidence}-confidence` }
  }
  // Wikipedia
  const s = sponsored[key]
  if (s === true)  return { result: true,  via: 'Wikipedia=true' }
  if (s === false) return { result: false, via: 'Wikipedia=false' }
  // Coach status fallback
  const c = coaches[key]
  if (c && typeof c === 'object') {
    if (c.status === 'no-program') return { result: false, via: 'coachStatus=no-program' }
    return { result: true, via: `coachStatus=${c.status}` }
  }
  // No data → default to true (existing matcher fallback)
  return { result: true, via: 'no-data-fallback' }
}

const overrideKeys = Object.keys(overrides).filter((k) => !k.startsWith('_') && overrides[k] === true)

const redundant: Array<{ key: string; via: string }> = []
const loadBearing: Array<{ key: string; via: string }> = []

for (const key of overrideKeys) {
  const { result, via } = hasProgramWithoutOverride(key)
  if (result === false) redundant.push({ key, via })
  else                  loadBearing.push({ key, via })
}

console.log(`Total override entries marked no-program: ${overrideKeys.length}\n`)

console.log(`=== REDUNDANT (matcher already returns false without override): ${redundant.length} ===`)
console.log(`These entries are belt-and-suspenders safety nets. Removing them is cosmetic — no behavior change.\n`)
for (const r of redundant) console.log(`  ${r.key.padEnd(35)} via ${r.via}`)

console.log(`\n=== LOAD-BEARING (matcher would return TRUE without override): ${loadBearing.length} ===`)
console.log(`These entries are doing real work. DO NOT remove without a replacement signal.\n`)
for (const lb of loadBearing) console.log(`  ${lb.key.padEnd(35)} would-be via ${lb.via}`)

console.log(`\nSummary: ${redundant.length}/${overrideKeys.length} entries are redundant; ${loadBearing.length}/${overrideKeys.length} are load-bearing.`)
