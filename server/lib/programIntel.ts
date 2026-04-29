import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import schoolsData from '../data/schools.json'
import type { ProgramIntel } from '../../client/src/types/index'

interface SchoolRecord {
  id: string
  name: string
  division: string
  conference: string
  location: string
  region: string
}

const CACHE_PATH = path.join(__dirname, '..', 'data', 'programIntelCache.json')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

type Cache = Record<string, ProgramIntel>

function loadCache(): Cache {
  try {
    if (!fs.existsSync(CACHE_PATH)) return {}
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Cache
  } catch {
    return {}
  }
}

function saveCache(cache: Cache) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
  } catch {
    // Cache is best-effort; never fail the request because we couldn't write it.
  }
}

function cacheKey(schoolId: string, gender: 'mens' | 'womens'): string {
  return `${schoolId}:${gender}`
}

// Pre-built search URLs that route the athlete to *real, current* search results
// instead of fabricated video links. The model is explicitly forbidden from
// emitting URLs of its own.
function searchQueries(school: SchoolRecord, gender: 'mens' | 'womens') {
  const program = `${school.name} ${gender === 'womens' ? "women's" : "men's"} soccer`
  const enc = (s: string) => encodeURIComponent(s)
  return [
    {
      label: 'YouTube highlights',
      url: `https://www.youtube.com/results?search_query=${enc(`${program} highlights 2024`)}`,
    },
    {
      label: 'YouTube full match',
      url: `https://www.youtube.com/results?search_query=${enc(`${program} full match`)}`,
    },
    {
      label: 'Official roster + schedule',
      url: `https://www.google.com/search?q=${enc(`${program} roster site:edu`)}`,
    },
    {
      label: 'Recent season recap',
      url: `https://www.google.com/search?q=${enc(`${program} 2024 season recap`)}`,
    },
    {
      label: 'Conference standings',
      url: `https://www.google.com/search?q=${enc(`${school.conference} ${gender === 'womens' ? "women's" : "men's"} soccer standings 2024`)}`,
    },
  ]
}

const PERSONA = `You are a college soccer scout. You provide tactical analysis only when you have specific, real knowledge of a program. You are explicit about uncertainty.`

const PROMPT = (school: SchoolRecord, gender: 'mens' | 'womens') => {
  const programLabel = gender === 'womens' ? "Women's" : "Men's"
  return `Analyze the ${programLabel} Soccer program at ${school.name} (${school.division}, ${school.conference}, ${school.location}).

Return tactical and program-level information you have specific knowledge of. Do NOT guess. Do NOT fabricate URLs. Do NOT include any links — links are provided separately by the application.

Confidence rules — set the "confidence" field as follows:
- "high": you have specific, recent (2022–2024) knowledge of this exact program's tactics, coaching, and results. This is rare; reserve it for top-tier D1 programs and well-documented D2/D3 programs.
- "medium": you have general knowledge of the program, conference context, and likely tactical tendencies, but cannot verify recent specifics.
- "low": this is a smaller or less-documented program. Provide division/conference baseline guidance and explicitly say so in caveats. DO NOT invent formations or tendencies you don't actually know.

For each field, only fill it in if you genuinely know. If you don't know the formation, say "Unknown — see search links to verify". If you don't know recent form, omit it.

Respond with JSON only:
{
  "formation": "4-3-3" | "4-2-3-1" | "Unknown — see search links",
  "formationVariants": ["3-4-3 in some matches"],
  "playstyle": "1-2 sentence description of how they play (possession-based, direct, pressing, etc.). If unknown, say so.",
  "tacticalNotes": ["3-6 specific tactical bullets — e.g. 'High press from front 3', 'Wide overlapping fullbacks', 'Set-piece-heavy attack'. Skip this list if you don't have specific knowledge."],
  "recentForm": "Optional: last-known season finish if you know it specifically (e.g. '2023: 12-6-2, NCAA second round'). Omit if you don't know.",
  "staffStability": "Optional: head coach tenure context if known (e.g. 'Anson Dorrance retired 2023, replaced by Damon Nahas'). Omit if you don't know.",
  "recruitingProfile": "Optional: what kind of player this program typically recruits (technical mids, athletic forwards, academic-priority, etc.).",
  "confidence": "high" | "medium" | "low",
  "caveats": ["3-5 explicit honesty statements about what you don't know or what could be outdated. ALWAYS include at least one caveat about verifying with the coach or current roster page."]
}`
}

async function generateIntel(school: SchoolRecord, gender: 'mens' | 'womens'): Promise<ProgramIntel> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 900,
    system: PERSONA,
    messages: [{ role: 'user', content: PROMPT(school, gender) }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')

  // Robust JSON parsing: tolerate code fences and stray prose.
  const cleaned = block.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  let parsed: Partial<ProgramIntel> = {}
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (m) {
      try { parsed = JSON.parse(m[0]) } catch { /* fall through to safe defaults */ }
    }
  }

  // Strip anything that smells like a URL — the model isn't allowed to provide
  // them and any that slipped through are unreliable.
  const stripUrls = (s: string | undefined) =>
    (s ?? '').replace(/https?:\/\/\S+/gi, '[link removed — see search links below]')

  const tacticalNotes = Array.isArray(parsed.tacticalNotes)
    ? parsed.tacticalNotes.map((n) => stripUrls(String(n))).filter((n) => n.trim().length > 0)
    : []
  const caveats = Array.isArray(parsed.caveats)
    ? parsed.caveats.map((c) => stripUrls(String(c))).filter((c) => c.trim().length > 0)
    : []

  // Always append a standing caveat so the user is never left without one.
  if (!caveats.some((c) => /verify|check|coach|current/i.test(c))) {
    caveats.push('Verify formation, roster, and recent results with the coach or the program\'s official page before relying on this in outreach.')
  }

  const confidence: ProgramIntel['confidence'] =
    parsed.confidence === 'high' ? 'high' :
    parsed.confidence === 'medium' ? 'medium' : 'low'

  return {
    schoolId: school.id,
    schoolName: school.name,
    gender,
    formation: stripUrls(parsed.formation) || 'Unknown — see search links',
    formationVariants: Array.isArray(parsed.formationVariants)
      ? parsed.formationVariants.map((v) => stripUrls(String(v))).filter((v) => v.trim().length > 0)
      : undefined,
    playstyle: stripUrls(parsed.playstyle) || 'Insufficient public film and reporting to describe playstyle reliably — use the search links to study recent matches.',
    tacticalNotes,
    recentForm: parsed.recentForm ? stripUrls(String(parsed.recentForm)) : undefined,
    staffStability: parsed.staffStability ? stripUrls(String(parsed.staffStability)) : undefined,
    recruitingProfile: parsed.recruitingProfile ? stripUrls(String(parsed.recruitingProfile)) : undefined,
    confidence,
    caveats,
    searchQueries: searchQueries(school, gender),
    cachedAt: new Date().toISOString(),
    source: 'ai-generated',
  }
}

export async function getProgramIntel(
  schoolId: string,
  gender: 'mens' | 'womens',
  options: { refresh?: boolean } = {},
): Promise<ProgramIntel> {
  const school = (schoolsData as SchoolRecord[]).find((s) => s.id === schoolId)
  if (!school) throw new Error(`Unknown school: ${schoolId}`)

  const cache = loadCache()
  const key = cacheKey(schoolId, gender)
  if (!options.refresh && cache[key]) return cache[key]

  const intel = await generateIntel(school, gender)
  cache[key] = intel
  saveCache(cache)
  return intel
}
