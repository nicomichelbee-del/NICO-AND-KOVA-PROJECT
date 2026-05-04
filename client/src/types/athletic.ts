export type ConfidenceTag = 'high' | 'medium' | 'low' | 'partial'

export interface SeasonRecord {
  season: number
  wins: number
  losses: number
  ties: number
  conferenceRecord: string | null
  ncaaTourneyRound: string | null
}

export interface ProgramRecord {
  schoolId: string
  gender: 'mens' | 'womens'
  recordHistory: SeasonRecord[]
  source: 'ncaa-api' | 'wikipedia' | 'mixed'
  confidence: ConfidenceTag
  lastVerified: string
}

export interface RecruitCommit {
  name: string
  position: string | null
  hometown: string | null
  club: string | null
}

export interface RecruitingClass {
  schoolId: string
  gender: 'mens' | 'womens'
  classYear: number
  recruitCount: number | null
  knownCommits: RecruitCommit[]
  source: 'tds' | 'site-scraped' | 'llm-research' | 'mixed'
  confidence: ConfidenceTag
  lastVerified: string
}
