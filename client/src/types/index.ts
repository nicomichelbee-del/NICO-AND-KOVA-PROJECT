export type Division = 'D1' | 'D2' | 'D3' | 'NAIA' | 'JUCO'

export type Region = 'any' | 'West' | 'Southwest' | 'Midwest' | 'Southeast' | 'Northeast'

export interface AthleteProfile {
  id?: string
  userId?: string
  name: string
  gradYear: number
  position: string
  gender: 'mens' | 'womens'
  clubTeam: string
  clubLeague: string
  gpa: number
  satAct?: string
  goals: number
  assists: number
  intendedMajor?: string
  highlightUrl?: string
  targetDivision: Division
  locationPreference: Region
  sizePreference: 'small' | 'medium' | 'large' | 'any'
  // Hard exclusions — divisions the athlete refuses to consider, e.g. "no
  // JUCO" or "no NAIA". Filtered out before scoring on the server. The
  // user's targetDivision is always implicitly allowed (UI prevents it
  // from being added here).
  excludedDivisions?: Division[]
}

export interface MatchBreakdown {
  // Top-line summaries (drive bucket assignment in v2 algo).
  athleticFit: number  // 0–100: how well athlete matches the program's recruiting profile
  academicFit: number  // 0–100: how well athlete matches the school's typical admit
  // Each axis is normalized 0–100. "yourValue" / "typicalValue" describe the
  // raw inputs the comparison was made on, so the UI can show side-by-side.
  gpa: { score: number; yourValue: number; typicalValue: number; verdict: string }
  stats: { score: number; yourValue: number; typicalValue: number; verdict: string } | null
  division: { score: number; yourTarget: Division; schoolDivision: Division; verdict: string }
  region: { score: number; yourPref: string; schoolRegion: string; verdict: string }
  size: { score: number; yourPref: string; schoolSize: string; verdict: string }
}

export interface School {
  id: string
  name: string
  division: Division
  location: string
  region: string
  size: 'small' | 'medium' | 'large'
  enrollment: number
  conference: string
  coachName?: string
  coachEmail?: string
  category: 'reach' | 'target' | 'safety'
  matchScore: number
  athleticFit?: number
  academicFit?: number
  reasons?: string[]  // 2–4 short bullets explaining the bucket; top 2 shown on card
  notes?: string
  programStrength?: number
  scholarships?: boolean
  gpaAvg?: number
  goalsForwardAvg?: number
  goalsMidAvg?: number
  breakdown?: MatchBreakdown
  // College Scorecard data (optional, present when schoolsAcademic.json has the school).
  satMid?: number | null
  sat25?: number | null
  sat75?: number | null
  admissionRate?: number | null     // 0–1
  costOfAttendance?: number | null  // total $ per year incl. room/board
  tuitionInState?: number | null
  tuitionOutOfState?: number | null
  pellGrantRate?: number | null     // 0–1
  graduationRate?: number | null    // 0–1
  // Roster signal (optional, present when rostersScraped.json has the school).
  // Lets the UI surface "open spots at your position" without re-computing.
  rosterSignal?: {
    totalAtPosition:   number
    graduatingByYear:  number
    juniorsAtPosition: number
    openSpots:         number
    totalRoster:       number
  }
  // Recruitable Shot — 0-100 probability the athlete realistically makes this
  // roster. Distinct from matchScore: matchScore is "is this a good fit",
  // recruitableShot is "what are your odds". Combines academic+athletic fit,
  // open spots at position, division gap, and program prestige.
  recruitableShot?: number
  // Confidence in the score itself (driven by how complete the school's data
  // is — Scorecard, roster, gpaAvg, etc.). Helps the UI hedge appropriately.
  dataConfidence?: 'high' | 'medium' | 'low'
  // Two-letter state extracted from `location` for client-side filtering.
  state?: string
}

export interface SchoolDirectoryEntry {
  id: string
  name: string
  division: Division
  conference: string
  location: string
  region: string
  size: 'small' | 'medium' | 'large'
  enrollment: number
  notes?: string
}

export interface ProgramIntel {
  schoolId: string
  schoolName: string
  gender: 'mens' | 'womens'
  formation: string                    // e.g., "4-3-3" or "Unknown"
  formationVariants?: string[]         // common alternate shapes
  playstyle: string                    // 1–2 sentence summary
  tacticalNotes: string[]              // bullet-point tendencies (3–6 items)
  recentForm?: string                  // last-known season summary
  staffStability?: string              // coach tenure / coaching change context
  recruitingProfile?: string           // what they look for in recruits
  confidence: 'high' | 'medium' | 'low'
  caveats: string[]                    // explicit honesty about gaps
  searchQueries: { label: string; url: string }[]  // pre-built search links (no fake URLs)
  cachedAt: string                     // ISO timestamp
  source: 'ai-generated'               // marker for the UI
}

export interface CoachEmail {
  id: string
  school: string
  division: Division
  coachName: string
  coachEmail: string
  subject: string
  body: string
  status: 'draft' | 'sent' | 'responded' | 'not_interested'
  sentAt?: string
  respondedAt?: string
  createdAt: string
}

export interface FindCoachResult {
  coachName: string
  coachEmail: string
  confidence: 'high' | 'low'
  source?: 'scraped' | 'scraped-partial' | 'email-inferred' | 'ai-recall'
  sourceUrl?: string
  scrapedAt?: string
}

export interface VideoFrame {
  timestamp: number
  data: string // base64 JPEG
}

export interface VideoRating {
  score: number              // overall 1-10, computed as average of 5 sub-scores
  detectedPosition?: string  // position the AI inferred from the footage (independent of profile)
  summary: string
  technical: string          // first touch, ball control, passing, finishing
  technicalScore: number     // 1-10
  tactical: string           // decision-making, positioning, awareness, off-ball movement
  tacticalScore: number      // 1-10
  composure: string          // poise under pressure: first touch when pressed, decisions in tight spaces, body language in challenges
  composureScore: number     // 1-10
  positionPlay: string       // how they play their specific position
  positionPlayScore: number  // 1-10
  divisionFit: string        // does the level of play match the target division
  divisionFitScore: number   // 1-10
  improvements: string[]
  screenshots?: VideoFrame[]
  duration?: number
  videoTitle?: string
}

export type SubscriptionTier = 'free' | 'pro' | 'family'

export interface User {
  id: string
  email: string
  tier: SubscriptionTier
  emailsUsed: number
  schoolMatchesUsed: number
}

export interface CoachResponse {
  id: string
  school: string
  coachName: string
  date: string
  rating: 'hot' | 'warm' | 'cold' | 'not_interested'
  score: number          // 1–10
  interestLevel: string  // e.g. "Very Interested"
  confidence: number
  signals: string[]
  nextAction: string
  genuineness: number
  genuinenessReason: string
  scoreReason: string
  rawText?: string
}

export interface CampCoach {
  name: string
  title: string
}

export interface IdCamp {
  id: string
  school: string
  division: Division
  campName: string
  date: string
  location: string
  cost: string
  url: string
  coaches: CampCoach[]
}

export interface LeaderboardEntry {
  id: string
  athleteName: string
  position: string
  clubTeam: string
  gradYear: number
  divisionGoal: Division
  score: number
  videoUrl: string
  ratedAt: string
}

export interface RosterProgram {
  id: string
  school: string
  conference: string
  division: Division
  location: string
  region: string
  state: string
  gender: 'mens' | 'womens'
  coachName: string
  coachEmail: string
  typicalRecruitingNeeds: { position: string; level: 'High' | 'Medium' | 'Low' }[]
  formationStyle: string
  notes: string
}

export interface PositionNeed {
  position: string
  demand: 'High' | 'Medium' | 'Low'
  schoolCount: number
}

export type StaffTier = 'S' | 'A' | 'B' | 'C' | 'D'

export interface IdEvent {
  id: string
  name: string
  organizer: string
  divisions: Division[]
  gender: 'mens' | 'womens' | 'both'
  dateRange: string
  location: string
  coachAttendance: string
  costRange: string
  url: string                       // Direct registration / event page
  searchFallbackUrl: string         // Google search fallback if direct URL rots
  staffTier: StaffTier              // Counselor's editorial rating
  staffTierReason: string           // One-line why
  notes: string
  lastReviewedAt: string            // ISO date — supports refresh workflows
}

export interface IdCampEntry {
  id: string
  schoolId: string
  schoolName: string
  gender: 'mens' | 'womens' | 'both'
  division: Division
  region: string
  campName: string
  format: 'residential' | 'day' | 'prospect-day' | 'elite-id'
  typicalMonths: string
  ageRange: string
  estimatedCost: string
  registrationUrl: string           // Direct registration / camp page (best known)
  searchFallbackUrl: string         // Google search fallback if direct URL rots
  athleticsUrl: string              // Direct official athletics site
  staffTier: StaffTier
  staffTierReason: string
  notes: string
  lastReviewedAt: string
}

export interface CampRatingSummary {
  campId: string
  averageRating: number             // 0 if no ratings
  ratingCount: number
  userRating: number | null         // The current user's existing rating, if any
}

export interface CampComment {
  id: string
  campId: string
  userId: string
  displayName: string
  body: string
  createdAt: string
}

export interface SchoolRecord {
  id: string
  name: string
  division: Division
  conference: string
  location: string
  region: string
  enrollment: number
  size: 'small' | 'medium' | 'large'
  mensCoach: string
  mensCoachEmail: string
  womensCoach: string
  womensCoachEmail: string
  gpaMin: number
  gpaAvg: number
  goalsForwardAvg: number
  goalsMidAvg: number
  programStrength: number
  scholarships?: boolean
  notes?: string
}

export interface OutreachContact {
  id: string
  userId: string
  coachName: string
  schoolName: string
  coachEmail: string
  position?: string
  division: Division
  gmailThreadId?: string
  interestRating: 'hot' | 'warm' | 'cold' | 'not_interested' | 'pending'
  lastReplyAt?: string
  lastReplySnippet?: string
  status: 'contacted' | 'replied' | 'scheduled_visit' | 'committed' | 'no_response'
  notes?: string
  createdAt: string
}

export interface SentEmail {
  id: string
  userId: string
  contactId: string
  gmailThreadId: string
  gmailMessageId: string
  subject: string
  body: string
  sentAt: string
  emailType: 'initial_outreach' | 'followup' | 'thank_you' | 'camp_inquiry'
}

export interface ThreadMessage {
  id: string
  sender: string
  timestamp: string
  body: string
  isFromCoach: boolean
}

export interface UntrackedThread {
  threadId: string
  senderEmail: string
  senderName: string
  subject: string
  snippet: string
  category: 'id_camp' | 'coach'
}

export interface HistoryEmail {
  threadId: string
  senderEmail: string
  senderName: string
  subject: string
  snippet: string             // from the coach's own message (not thread snippet)
  date: string                // ISO timestamp of the coach's latest message
  category: 'id_camp' | 'coach'
  isTracked: boolean
  personalizationNote: string
  messageCount: number        // total messages in thread
  coachMessageCount: number   // how many times coach has messaged
  // AI interest analysis — two independent scores that can and should diverge
  score: number               // 1–10 INTEREST: forward momentum / concrete asks
  rating: 'hot' | 'warm' | 'cold' | 'not_interested'
  interestLevel: string
  genuineness: number         // 1–10 GENUINENESS: personal engagement vs. mass-send quality
  ratingNote: string          // one-sentence summary of what the coach said
  nextAction: string
  // Noise classification — mass ID camp blasts, newsletters, subscription updates
  isNoise?: boolean
  noiseReason?: string
}

export * from './athletic'
