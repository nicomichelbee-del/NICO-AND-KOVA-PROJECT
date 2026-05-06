// Known recruiting platform / bulk-service domains — never a real coach email
const PLATFORM_DOMAINS = new Set([
  'ncsa.com', 'ncsasports.org', 'berecruited.com', 'sportsrecruits.com',
  '247sports.com', 'rivals.com', 'fieldlevel.com', 'rezscore.com',
  'leagueapps.com', 'sportngin.com', 'teamsnap.com', 'hudl.com',
  'maxpreps.com', 'rank1sports.com', 'preprecruiting.com',
  'topdrawersoccer.com', 'topdrawer.com',
  'imginc.com', 'imgacademy.com',
  'activenetwork.com', 'active.com',
  'prepforce.com', 'scoutnet.com', 'registermyathlete.com',
  'athleticscholarships.net', 'collegiatesoccer.com',
  'mailchimp.com', 'constantcontact.com',
  'sendgrid.net', 'sendgrid.com',
  'mailgun.org', 'mailjet.com',
  'klaviyo.com', 'drip.com',
  'amazonses.com', 'sparkpostmail.com', 'mandrillapp.com',
  'hubspot.com', 'hubspotemail.net',
  'salesforce.com', 'exacttarget.com', 'marketo.com', 'responsys.com',
])

// Sender address prefixes that are never real humans
const BULK_PREFIX = /^(noreply|no-reply|donotreply|do-not-reply|notifications?|newsletter|updates?|mailer|alert|alerts|recruiting-auto|list(-serve)?|listserve|bounce|automated?|system|bulk|broadcast|announce|info|contact|admin|support|help|hello|hi|team|staff|office|registrar|admissions|enrollment|notify|news|bulletin)@/i

// Local-part patterns on .edu addresses that indicate a department/system inbox, not a real person
const INSTITUTIONAL_EMAIL_LOCAL = /^(athletics|athletic|soccer|sports|recruiting|enrollment|campvisit|visits?|camps?|events?|program|department|notify|notification|announce|broadcast|bulk)$/i

// Precompiled subject-line regex — mass sends, recruiting platform notifications, and newsletters
const BULK_SUBJECT_RE = new RegExp(
  [
    'unsubscribe', 'registration is now open', 'spots are filling',
    'click here to register', 'this email was sent to', 'you are receiving this',
    'view in browser', 'manage your preferences', 'email preferences',
    'has viewed your profile', 'coach is interested in you',
    'new coach connection', 'a coach wants to connect',
    'your recruiting profile', 'profile has been viewed',
    'limited spots available', 'register for our',
    'we found coaches interested', 'coaches are looking at you',
    'recruiting update from ncsa', 'topdrawer', 'berecruited',
    // Newsletter / digest patterns
    'recruiting newsletter', 'soccer newsletter', 'weekly digest',
    'monthly digest', 'recruiting digest', 'weekly update',
    'monthly update', 'this week in recruiting', 'recruiting roundup',
    'top prospects', 'prospect rankings', 'top recruits',
    'registration deadline', 'camp is filling fast',
    'sign up now', 'sign up before',
  ].map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i',
)

// Newsletter-style subjects that may slip through without proper bulk headers.
// Used as a secondary check after isBulkMessage passes.
const NEWSLETTER_SUBJECT_RE = /\b(newsletter|weekly digest|monthly digest|recruiting digest|weekly update|monthly update|this week in|recruiting roundup|top recruits|top prospects|prospect rankings|recruiting news)\b/i

/** Returns true if the subject looks like newsletter/subscription content. */
export function isNewsletterEmail(subject: string): boolean {
  return NEWSLETTER_SUBJECT_RE.test(subject)
}

// Display-name words that indicate a role / department, not a real person
const INSTITUTIONAL_WORDS = /\b(university|college|athletics|athletic|soccer|football|basketball|baseball|softball|sports|recruiting|recruitment|staff|office|department|program|team|academy|institute|admissions|registrar|ncsa|topdrawer|berecruited|fieldlevel)\b/i

const ID_CAMP_KEYWORDS = [
  'id camp', 'id-camp', 'identification camp', 'prospect day', 'elite id',
  'camp registration', 'soccer camp', 'id event',
]

const COACH_SUBJECT_KEYWORDS = [
  'recruiting', 'recruit', 'roster', 'scholarship', 'visit', 'tryout',
  'head coach', 'assistant coach',
]

export type EmailCategory = 'id_camp' | 'coach' | 'other'
export type EmailConfidence = 'accept' | 'uncertain'

export function getHeader(headers: any[], name: string): string {
  return headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''
}

/** Returns true if this message has hard signals of a bulk/automated/spam send. */
export function isBulkMessage(headers: any[], senderEmail: string, subject: string): boolean {
  const g = (n: string) => getHeader(headers, n).toLowerCase()
  if (g('list-unsubscribe')) return true
  if (['bulk', 'list', 'junk'].includes(g('precedence'))) return true
  if (g('x-campaign-id') || g('x-mailchimp-campaign') || g('x-bulk-signature')) return true
  if (g('x-spam-flag').startsWith('yes')) return true
  if (g('x-spam-status').startsWith('yes')) return true
  const xm = g('x-mailer')
  if (xm.includes('mailchimp') || xm.includes('constant contact') || xm.includes('hubspot') || xm.includes('sendgrid')) return true
  const email = senderEmail.toLowerCase()
  if (BULK_PREFIX.test(email)) return true
  const domain = email.split('@')[1] ?? ''
  if (PLATFORM_DOMAINS.has(domain)) return true
  if (BULK_SUBJECT_RE.test(subject)) return true
  return false
}

/**
 * Three-tier classifier for a non-bulk message from a coach-like sender.
 * 'accept'   → strong deterministic signal this is a real human at a college; skip AI
 * 'uncertain' → could be real but ambiguous; send to Claude for verification
 */
export function classifyCoachMessage(
  displayName: string,
  senderEmail: string,
  subject: string,
): EmailConfidence {
  const subjectLower = subject.toLowerCase().trim()
  const emailLower = senderEmail.toLowerCase()
  const [localPart, domain] = emailLower.split('@')

  // Not a department inbox on a .edu domain — indicates a real person's address
  const isIndividualEduAddress =
    (domain ?? '').endsWith('.edu') && !INSTITUTIONAL_EMAIL_LOCAL.test(localPart ?? '')

  // A reply to an email the athlete sent — only accept if from a personal .edu address,
  // not a department inbox like athletics@, soccer@, info@, etc.
  if (/^re:/i.test(subjectLower)) {
    if (isIndividualEduAddress) return 'accept'
    return 'uncertain'
  }

  // Forwarded coach communication from a personal .edu address
  if (/^(fwd?|fw):/i.test(subjectLower) && isIndividualEduAddress) return 'accept'

  // Display name looks like a real human name (2-4 words, capitalised, no institutional words)
  const cleanName = displayName.replace(/['"<>]/g, '').trim()
  if (cleanName && !INSTITUTIONAL_WORDS.test(cleanName)) {
    const parts = cleanName.split(/\s+/)
    const looksLikePerson =
      parts.length >= 2 &&
      parts.length <= 4 &&
      parts.every((p) => /^[A-Z]/.test(p) || /^[A-Z]{1,3}\.?$/.test(p))
    if (looksLikePerson && isIndividualEduAddress) return 'accept'
  }

  return 'uncertain'
}

export function categorizeEmail(senderEmail: string, subject: string): EmailCategory {
  const lower = subject.toLowerCase()
  if (ID_CAMP_KEYWORDS.some((kw) => lower.includes(kw))) return 'id_camp'
  if (senderEmail.toLowerCase().endsWith('.edu')) return 'coach'
  if (COACH_SUBJECT_KEYWORDS.some((kw) => lower.includes(kw))) return 'coach'
  return 'other'
}

export function isCoachEmail(senderEmail: string, subject: string): boolean {
  return categorizeEmail(senderEmail, subject) !== 'other'
}

type SchoolMeta = { id: string; name: string; division?: string }

/**
 * Best-effort school resolver from a coach email + sender display name.
 * Returns the matched school's name + division when found, or a name-only fallback
 * (no division) when the domain can't be matched against schools.json.
 *
 * Strategy:
 *   1. Strip subdomains, take the bare domain root (e.g. mail.athletics.harvard.edu → harvard)
 *   2. Match against schools.json by `id` or fuzzy name containment
 *   3. Look at the sender's display name for embedded school references ("UNC Soccer", "Harvard Athletics")
 *   4. Fallback: title-case the domain root, no division
 */
export function resolveSchoolMetaFromEmail(
  senderEmail: string,
  senderName: string,
  schools: SchoolMeta[],
): { name: string; division: string | null } {
  const email = senderEmail.toLowerCase().trim()
  const domain = email.split('@')[1] ?? ''
  if (!domain) return { name: '', division: null }

  const parts = domain.split('.').filter(Boolean)
  // For .edu, root = second-to-last (harvard.edu → "harvard"). For other TLDs, same logic works.
  const root = parts.length >= 2 ? parts[parts.length - 2] : domain
  const rootLower = root.toLowerCase()

  // Direct id match — schools.json ids like "harvard", "unc", "stanford"
  const byId = schools.find((s) => s.id.toLowerCase() === rootLower)
  if (byId) return { name: byId.name, division: byId.division ?? null }

  // Fuzzy: school id is contained in domain root (e.g. unc.edu vs id "unc-charlotte")
  // or domain root is contained in school name (without spaces/punctuation)
  const cleanedRoot = rootLower.replace(/[^a-z]/g, '')
  if (cleanedRoot.length >= 3) {
    const fuzzy = schools.find((s) => {
      const idClean = s.id.toLowerCase().replace(/[^a-z]/g, '')
      const nameClean = s.name.toLowerCase().replace(/[^a-z]/g, '')
      return idClean === cleanedRoot || nameClean.includes(cleanedRoot) || cleanedRoot.includes(idClean)
    })
    if (fuzzy) return { name: fuzzy.name, division: fuzzy.division ?? null }
  }

  // Sender display name often carries the school: "Coach Smith — UNC Soccer", "Harvard Athletics"
  const cleanedName = senderName.replace(/<[^>]+>/, '').replace(/['"]/g, '').trim()
  if (cleanedName) {
    const lower = cleanedName.toLowerCase()
    const byName = schools.find((s) => {
      const idLower = s.id.toLowerCase()
      const nameLower = s.name.toLowerCase()
      return lower.includes(idLower) || lower.includes(nameLower)
    })
    if (byName) return { name: byName.name, division: byName.division ?? null }
  }

  // Last resort: title-case the domain root, no division match
  return { name: root.charAt(0).toUpperCase() + root.slice(1), division: null }
}

/** @deprecated — use resolveSchoolMetaFromEmail to also pick up the matched division. */
export function resolveSchoolFromEmail(
  senderEmail: string,
  senderName: string,
  schools: SchoolMeta[],
): string {
  return resolveSchoolMetaFromEmail(senderEmail, senderName, schools).name
}

/**
 * Best-guess coach name from sender display name.
 * Strips quotes, angle brackets, and common institutional suffixes.
 * Returns empty string if the name looks institutional (e.g. "Harvard Athletics").
 */
export function resolveCoachName(senderName: string, senderEmail: string): string {
  const cleaned = senderName.replace(/<[^>]+>/, '').replace(/['"]/g, '').trim()
  if (!cleaned) return ''
  // Reject pure institutional names — caller can leave coach blank for the user to fill in
  if (/\b(athletics|athletic|soccer|university|college|recruiting|admissions|department)\b/i.test(cleaned)) {
    // But if there's a personal name BEFORE the institutional word, keep it
    const beforeInstitutional = cleaned.split(/[-—|·,]/)[0].trim()
    if (beforeInstitutional && beforeInstitutional !== cleaned && !/\b(athletics|soccer|university|college)\b/i.test(beforeInstitutional)) {
      return beforeInstitutional
    }
    return ''
  }
  // Strip a trailing email if it leaked into the display name
  return cleaned.replace(/<.*$/, '').trim() || senderEmail.split('@')[0]
}

// Recursively find the first part of `mimeType` anywhere in the MIME tree.
// Gmail nests text/plain and text/html inside multipart/alternative, which is itself
// often nested inside multipart/mixed when attachments or quoted history are present.
function findPart(payload: any, mimeType: string): any {
  if (!payload) return null
  if (payload.mimeType === mimeType && payload.body?.data) return payload
  for (const part of payload.parts ?? []) {
    const hit = findPart(part, mimeType)
    if (hit) return hit
  }
  return null
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8')
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Pure filter for the sync auto-rate batch. Pinned by tests so a future edit cannot
// silently regress the token-leak guarantees:
//   1. Already-rated contacts (interestRating !== 'pending') are NEVER re-rated.
//   2. Contacts with no reply snippet are excluded — nothing to analyse, no spend.
//   3. Per-sync cap is enforced — extras roll to the next sync.
// Cap balances "rate everything in one go" against Claude token spend per sync.
// At 75, batchRateCoachEmails fans out to ~4 parallel Claude calls (chunks of 20),
// covering >95% of users' inboxes in a single sync. Heavier inboxes finish over the
// next sync or two — once rated, contacts are never re-rated.
export const AUTO_RATE_CAP = 75
export function selectContactsToAutoRate<T extends { interestRating: string; lastReplySnippet?: string | null }>(
  contacts: T[],
  cap: number = AUTO_RATE_CAP,
): T[] {
  return contacts
    .filter((c) => c.interestRating === 'pending' && (c.lastReplySnippet ?? '').trim().length > 0)
    .slice(0, cap)
}

export function decodeMessageBody(payload: any): string {
  if (!payload) return ''
  const plain = findPart(payload, 'text/plain')
  if (plain) return decodeBase64Url(plain.body.data)
  const html = findPart(payload, 'text/html')
  if (html) return htmlToText(decodeBase64Url(html.body.data))
  if (payload.body?.data) return decodeBase64Url(payload.body.data)
  return ''
}
