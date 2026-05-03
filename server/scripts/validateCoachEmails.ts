/**
 * Email-domain validator for scraped coach data.
 * Rejects free-mail and non-institutional emails; downgrades web-verified → web-name-only.
 *
 * Usage:
 *   npx tsx server/scripts/validateCoachEmails.ts
 *   npx tsx server/scripts/validateCoachEmails.ts --dry-run
 */

import * as fs from 'fs'
import * as path from 'path'
import { ATHLETICS_DOMAINS } from './athleticsDomains'

const CACHE_PATH = path.join(__dirname, '..', 'data', 'coachesScraped.json')
const DRY_RUN = process.argv.includes('--dry-run')

interface ScrapedCoach {
  schoolId: string; schoolName: string; gender: 'mens' | 'womens'
  coachName: string; coachTitle: string; coachEmail: string
  sourceUrl: string; scrapedAt: string; status: string; reason?: string
}

const FREE_MAIL = new Set([
  'gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com',
  'msn.com','proton.me','protonmail.com','ymail.com','live.com','me.com',
  'mac.com','mail.com','gmx.com','zoho.com',
])

function emailDomain(email: string): string {
  const m = email.toLowerCase().match(/@([^@\s>]+)\s*$/)
  return m ? m[1] : ''
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, '')
}

function looksInstitutional(email: string, school: ScrapedCoach): { ok: boolean; reason: string } {
  const domain = emailDomain(email)
  if (!domain) return { ok: false, reason: 'malformed email' }
  if (FREE_MAIL.has(domain)) return { ok: false, reason: `free-mail: ${domain}` }
  if (/\.(edu|gov|mil)$/.test(domain)) return { ok: true, reason: '.edu/.gov/.mil' }
  if (/\.ac\.[a-z]{2}$/.test(domain)) return { ok: true, reason: 'academic domain' }

  const athDom = ATHLETICS_DOMAINS[school.schoolId]?.toLowerCase()
  if (athDom && (domain === athDom || domain.endsWith('.' + athDom) || athDom.endsWith('.' + domain))) {
    return { ok: true, reason: 'matches athletics domain' }
  }
  const norm = normalizeName(school.schoolName)
  if (norm.length >= 4) {
    const dn = domain.replace(/[^a-z]/g, '')
    if (dn.includes(norm.slice(0, 6)) || norm.includes(dn.slice(0, 6))) {
      return { ok: true, reason: 'domain matches school name' }
    }
  }
  return { ok: false, reason: `non-institutional domain: ${domain}` }
}

function main() {
  const cache: Record<string, ScrapedCoach> = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  let kept = 0, downgraded = 0, alreadyEmpty = 0
  const log: string[] = []

  for (const [key, entry] of Object.entries(cache)) {
    if (!entry.coachEmail) { alreadyEmpty++; continue }
    const { ok, reason } = looksInstitutional(entry.coachEmail, entry)
    if (ok) { kept++; continue }
    log.push(`  ${key.padEnd(32)} ${entry.coachEmail.padEnd(35)} — ${reason}`)
    if (!DRY_RUN) {
      cache[key] = {
        ...entry, coachEmail: '',
        status: entry.status === 'web-verified' ? 'web-name-only'
               : entry.status === 'success' ? 'partial'
               : entry.status === 'email-inferred' ? 'partial'
               : entry.status,
        reason: `email cleared: ${reason}`,
      }
    }
    downgraded++
  }

  console.log('══ EMAIL VALIDATION ══')
  console.log(`Kept: ${kept}  Downgraded: ${downgraded}  Already empty: ${alreadyEmpty}`)
  if (log.length) { console.log('\nDowngraded:'); log.forEach(l => console.log(l)) }
  if (!DRY_RUN && downgraded > 0) {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
    console.log('\n✅ Saved.')
  } else if (DRY_RUN) {
    console.log('\nDry run — no writes.')
  } else {
    console.log('\nNo changes needed.')
  }
}

main()
