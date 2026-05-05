import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import rosterPrograms from '../data/rosterPrograms.json'

const router = Router()

function getSupabaseOrNull() {
  const url = process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !key || key === 'placeholder_anon_key') return null
  return createClient(url, key)
}

// Cache claim overrides for 60s — refreshes automatically as coaches edit their needs,
// but avoids hitting Supabase on every public page view.
let overridesCache: { at: number; map: Map<string, { needs?: { position: string; level: 'High' | 'Medium' | 'Low' }[]; notes?: string }> } | null = null
async function loadOverrides() {
  if (overridesCache && Date.now() - overridesCache.at < 60_000) return overridesCache.map
  const supabase = getSupabaseOrNull()
  const map = new Map<string, { needs?: { position: string; level: 'High' | 'Medium' | 'Low' }[]; notes?: string }>()
  if (supabase) {
    const { data } = await supabase
      .from('claimed_programs')
      .select('school_id, gender, needs_overrides, notes_override')
    for (const row of data ?? []) {
      const key = `${row.school_id}|${row.gender}`
      map.set(key, {
        needs: row.needs_overrides ?? undefined,
        notes: row.notes_override ?? undefined,
      })
    }
  }
  overridesCache = { at: Date.now(), map }
  return map
}

type Gender = 'mens' | 'womens'
type Level = 'High' | 'Medium' | 'Low'

interface RawProgram {
  id: string
  school: string
  conference: string
  division: string
  location: string
  gender: Gender
  coachName: string
  coachEmail: string
  typicalRecruitingNeeds: { position: string; level: Level }[]
  formationStyle: string
  notes: string
}

const POSITION_ALIASES: Record<string, string[]> = {
  goalkeeper: ['goalkeeper', 'gk', 'keeper'],
  'center-back': ['center back', 'centre back', 'cb'],
  'outside-back': ['outside back', 'fullback', 'full back', 'right back', 'left back'],
  'defensive-mid': ['defensive midfielder', 'defensive mid', 'cdm', 'holding mid'],
  'central-mid': ['central midfielder', 'central mid', 'cm', 'midfielder'],
  'attacking-mid': ['attacking midfielder', 'attacking mid', 'cam', '#10'],
  winger: ['winger', 'right winger', 'left winger', 'wing', 'wide forward'],
  forward: ['forward', 'striker', 'center forward', 'cf', '#9'],
}

function matchesPositionSlug(needPosition: string, slug: string): boolean {
  const aliases = POSITION_ALIASES[slug] ?? [slug.replace(/-/g, ' ')]
  const lower = needPosition.toLowerCase()
  return aliases.some((a) => lower.includes(a))
}

function levelWeight(level: Level): number {
  return level === 'High' ? 3 : level === 'Medium' ? 2 : 1
}

// GET /api/public/open-spots?gender=&position=&division=
router.get('/open-spots', async (req, res) => {
  const gender = (req.query.gender as Gender) ?? 'womens'
  const positionSlug = (req.query.position as string | undefined)?.toLowerCase()
  const division = req.query.division as string | undefined

  const overrides = await loadOverrides()

  // Apply coach overrides to recruiting needs before filtering. When a coach
  // has claimed their program and edited their needs, those win over the
  // baseline rosterPrograms.json data — that's the moat-building loop.
  const programsWithOverrides = (rosterPrograms as RawProgram[]).map((p) => {
    const ov = overrides.get(`${p.id}|${p.gender}`)
    return ov?.needs ? { ...p, typicalRecruitingNeeds: ov.needs, notes: ov.notes ?? p.notes } : p
  })

  const programs = programsWithOverrides.filter((p) => {
    if (p.gender !== gender) return false
    if (division && division !== 'all' && p.division !== division) return false
    if (positionSlug) {
      return p.typicalRecruitingNeeds.some(
        (n) => matchesPositionSlug(n.position, positionSlug) && n.level !== 'Low',
      )
    }
    return true
  })

  // Public surface: drop the coach contact info — gate that behind signup.
  const sanitized = programs
    .map((p) => {
      const matchingNeed = positionSlug
        ? p.typicalRecruitingNeeds.find((n) => matchesPositionSlug(n.position, positionSlug))
        : null
      return {
        id: p.id,
        school: p.school,
        conference: p.conference,
        division: p.division,
        location: p.location,
        formationStyle: p.formationStyle,
        notes: p.notes,
        gender: p.gender,
        recruitingLevel: matchingNeed?.level ?? null,
        topNeeds: p.typicalRecruitingNeeds
          .filter((n) => n.level === 'High')
          .map((n) => n.position)
          .slice(0, 3),
        coachVerified: overrides.has(`${p.id}|${p.gender}`),
      }
    })
    .sort((a, b) => {
      // Sort: open level (High > Medium > Low), then division (D1 first), then alpha
      const aWeight = a.recruitingLevel ? levelWeight(a.recruitingLevel) : 0
      const bWeight = b.recruitingLevel ? levelWeight(b.recruitingLevel) : 0
      if (aWeight !== bWeight) return bWeight - aWeight
      const divOrder = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']
      const dGap = divOrder.indexOf(a.division) - divOrder.indexOf(b.division)
      if (dGap !== 0) return dGap
      return a.school.localeCompare(b.school)
    })

  // Aggregate counts the page can render as a hero stat.
  const counts = {
    total: sanitized.length,
    high: sanitized.filter((p) => p.recruitingLevel === 'High').length,
    medium: sanitized.filter((p) => p.recruitingLevel === 'Medium').length,
    byDivision: {
      D1: sanitized.filter((p) => p.division === 'D1').length,
      D2: sanitized.filter((p) => p.division === 'D2').length,
      D3: sanitized.filter((p) => p.division === 'D3').length,
      NAIA: sanitized.filter((p) => p.division === 'NAIA').length,
      JUCO: sanitized.filter((p) => p.division === 'JUCO').length,
    },
  }

  res.json({ programs: sanitized, counts })
})

// GET /api/public/health — Railway/Vercel healthcheck endpoint
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// GET /sitemap.xml is mounted at the app root in server/index.ts and
// proxies to this handler. We expose every (gender × position) URL so search
// engines can crawl and index them individually.
router.get('/sitemap', (req, res) => {
  // PUBLIC_BASE_URL takes precedence in prod so the sitemap advertises the
  // canonical domain (kickriq.com) even when this handler runs on Railway/Vercel.
  const host = process.env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get('host')}`
  const positions = Object.keys(POSITION_ALIASES)
  const urls = [
    `${host}/`,
    `${host}/open-spots`,
    `${host}/open-spots/womens`,
    `${host}/open-spots/mens`,
    ...positions.flatMap((p) => [
      `${host}/open-spots/womens/${p}`,
      `${host}/open-spots/mens/${p}`,
    ]),
  ]
  const today = new Date().toISOString().slice(0, 10)
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${u.includes('/open-spots/') ? '0.8' : '0.6'}</priority></url>`,
      )
      .join('\n') +
    `\n</urlset>\n`
  res.type('application/xml').send(body)
})

// GET /api/public/positions — list of position slugs the SEO pages support
router.get('/positions', (_req, res) => {
  const positions = Object.keys(POSITION_ALIASES).map((slug) => {
    const counts = { mens: 0, womens: 0 }
    for (const p of rosterPrograms as RawProgram[]) {
      const has = p.typicalRecruitingNeeds.some(
        (n) => matchesPositionSlug(n.position, slug) && n.level !== 'Low',
      )
      if (has) counts[p.gender]++
    }
    return {
      slug,
      label: slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
      counts,
    }
  })
  res.json({ positions })
})

export default router
