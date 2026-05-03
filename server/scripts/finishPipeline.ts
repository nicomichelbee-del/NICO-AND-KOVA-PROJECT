/**
 * Pipeline finisher.
 *
 * Runs the post-web-research steps in order:
 *   1. validateCoachEmails   — rejects non-institutional / free-mail emails
 *   2. inferEmails           — pattern-fills emails for name-only entries
 *   3. seedSchools           — upserts schools + coaches to Supabase
 *
 * Usage:
 *   npx tsx server/scripts/finishPipeline.ts
 *   npx tsx server/scripts/finishPipeline.ts --dry-run   # preview each step, no writes
 */

import { execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

const DRY_RUN = process.argv.includes('--dry-run')
const ROOT = path.join(__dirname, '..', '..')
const CACHE_PATH = path.join(__dirname, '..', 'data', 'coachesScraped.json')

function run(script: string, extraArgs = '') {
  const cmd = `npx tsx ${path.join(__dirname, script)} ${DRY_RUN ? '--dry-run' : ''} ${extraArgs}`.trim()
  console.log(`\n▶  ${cmd}\n${'─'.repeat(60)}`)
  execSync(cmd, { stdio: 'inherit', cwd: ROOT })
}

function statusSummary() {
  const cache: Record<string, any> = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  const s: Record<string, number> = {}
  let withEmail = 0
  for (const e of Object.values(cache)) {
    s[e.status] = (s[e.status] ?? 0) + 1
    if (e.coachEmail) withEmail++
  }
  const total = Object.keys(cache).length
  console.log(`\n  Total entries : ${total}`)
  console.log(`  With email    : ${withEmail} (${Math.round(withEmail / total * 100)}%)`)
  Object.entries(s).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
    console.log(`  ${k.padEnd(18)} ${v}`)
  )
}

async function main() {
  console.log('══ PIPELINE FINISHER ══')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('\nBefore:')
  statusSummary()

  run('validateCoachEmails.ts')
  run('inferEmails.ts')
  run('seedSchools.ts')

  console.log('\nAfter:')
  statusSummary()
  console.log('\n✅ Pipeline complete.')
}

main().catch(e => {
  console.error('PIPELINE FAILED:', e)
  process.exit(1)
})
