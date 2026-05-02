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

export function decodeMessageBody(payload: any): string {
  if (!payload) return ''
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8')
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8').replace(/<[^>]*>/g, '')
      }
    }
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  }
  return ''
}
