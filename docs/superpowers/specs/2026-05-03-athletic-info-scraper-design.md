# Athletic Info Scraper — Design Spec

**Date:** 2026-05-03
**Status:** Approved for implementation planning
**Budget cap:** $20 USD per full season run (Anthropic API)

## Goal

Add a small set of accurate, per-program athletic data points to the existing
KickrIo school database, focused on what an athlete actually uses to evaluate
fit with a school: who to contact, how strong the program is, and whether a
realistic recruiting opportunity exists this cycle.

This spec deliberately narrows what gets scraped. Earlier drafts considered a
broad "everything athletic" pull (rosters, schedules, goals for/against,
formations). Per the user's directive, those are out of scope.

## In-Scope Fields

For every D1, D2, D3 men's and women's soccer program (612 schools × 2 genders
= 1,224 program-targets):

1. **Coach name** — head coach, current
2. **Coach email** — institutional `.edu` only, never freemail or fabricated
3. **Competitive record** — last 3 seasons of W-L-T, conference record, and
   NCAA tournament round reached if any
4. **Recruiting class composition** — incoming class for the next academic
   year: count of known commits, names where available, position, hometown,
   club. Honesty over completeness — partial data is fine if tagged.
5. **Division** and **Location** — already populated, validated for drift only

## Out of Scope

- Goals for / goals against / per-player stats
- Schedule and live results
- Formation / playstyle / tactical analysis
- Roster expansion beyond what already exists
- NAIA and JUCO programs (NAIA may be added later; JUCO accuracy is
  explicitly de-prioritized)

## Existing State (audited 2026-05-03)

| Field | Coverage | Notes |
|---|---|---|
| Division, location, conference, region | 612/612 (100%) | `schools.json` |
| Coach name | 778/1,224 (64%) | `coachesScraped.json` — 446 gap |
| Coach email | 739/1,224 (60%) | institutional `.edu` only — 485 gap |
| Competitive record | 0/1,224 | new |
| Recruiting class | 0/1,224 | new |

Existing fields `goalsForwardAvg`, `goalsMidAvg`, `programStrength`,
`gpaAvg` in `schools.json` are seeded heuristics, not scraped data. They
remain in place but are not the source of truth for program strength once
this scraper runs — `recordHistory` becomes the authoritative signal.

## Architecture

Three independent scripts in `server/scripts/`. Each is resume-safe, writes
to its own JSON file, and respects a shared spend tracker.

### 1. `fillCoachGaps.ts`

Targets only the 485 programs with missing or invalid email and the 446 with
missing coach name. D1/D2/D3 only. Reuses the existing institutional-email
validator.

- **Pass 1 — Haiku 4.5 + web_search.** Cheap (~$0.002/call). Targets all
  remaining gaps. Expected ~50% recovery on the email gap, higher on
  name-only.
- **Pass 2 — Sonnet 4.5 + web_search.** For the residual misses after Pass 1.
  Stricter prompt requiring direct quotation of the source page.
- **Filter:** every recovered email must pass `validateCoachEmails.ts` rules
  (institutional `.edu` domain, no freemail, no role-mailbox unless verified).
  Reject silently rather than store junk.
- **Output:** updates `coachesScraped.json` in place. Adds new statuses
  `haiku-verified` and `sonnet-verified` for trace.

Estimated cost: $5–8.

### 2. `scrapeRecord.ts`

Pulls competitive record from official, free public sources. Anthropic API is
not used in this script.

- **Primary source:** the public NCAA stats feed at `data.ncaa.com`.
  Endpoint pattern: `data.ncaa.com/casablanca/schedule/<sport-code>/<year>/<team-id>/schedule.json`
  for schedules and the team scoreboard endpoints for season totals.
- **Coverage:** D1, D2, D3 — all in NCAA. Both men's and women's soccer.
- **Historical fallback:** Wikipedia program articles for NCAA tournament
  history (parse infobox + table; no LLM needed).
- **Output schema:**

```ts
{
  schoolId: string,
  gender: 'mens' | 'womens',
  recordHistory: [
    {
      season: number,           // e.g. 2024
      wins: number,
      losses: number,
      ties: number,
      conferenceRecord: string, // "5-3-1"
      ncaaTourneyRound: string | null  // "First Round" | "Final Four" | null
    }
  ],
  source: 'ncaa-api' | 'wikipedia' | 'mixed',
  confidence: 'high' | 'medium' | 'low',
  lastVerified: string         // ISO timestamp
}
```

- **File:** `server/data/programRecords.json`, keyed by `schoolId:gender`.

Estimated cost: $0.

### 3. `scrapeRecruitingClass.ts`

The fuzziest field. Three sources tried in order; first hit wins, sources
recorded.

- **Source 1 — TopDrawerSoccer commit lists.** Public, free. Covers most D1
  and roughly half of D2 men's; women's coverage is thinner. Scrape with
  Puppeteer using the existing scraper utilities. Check robots.txt at run
  start; if commits paths are disallowed, skip Source 1 entirely and rely
  on Sources 2 and 3. Rate limit at 1 req/sec when allowed.
- **Source 2 — Sidearm template scrape of `/news`.** Pulls "Class of 20XX
  Signing Day" press releases from official athletic sites. Existing
  Sidearm-template knowledge from `scrapeRosters.ts` makes this cheap.
- **Source 3 — Sonnet 4.5 + web_search.** Fallback only. Used for D3 and
  whichever programs failed sources 1 and 2. Hard-capped via the spend
  tracker.

- **Output schema:**

```ts
{
  schoolId: string,
  gender: 'mens' | 'womens',
  classYear: number,           // grad year, e.g. 2026
  recruitCount: number | null, // null if unknown
  knownCommits: [
    {
      name: string,
      position: string | null,
      hometown: string | null,
      club: string | null
    }
  ],
  source: 'tds' | 'site-scraped' | 'llm-research' | 'mixed',
  confidence: 'high' | 'medium' | 'low' | 'partial',
  lastVerified: string
}
```

- **File:** `server/data/recruitingClasses.json`, keyed by `schoolId:gender`.

Estimated cost: $5–7.

## Reliability Rules

These are non-negotiable invariants enforced in code, not just convention:

1. **Every field carries `source`, `confidence`, `lastVerified`.** A field
   with no provenance is treated as missing.
2. **Spend tracker** at `server/data/.scraperBudget.json`. The orchestrator
   reads it before every paid call and refuses to spend past $18 (soft) or
   $20 (hard). At $18 it downgrades from Sonnet to Haiku; at $20 it stops.
3. **No fabricated coach emails, ever.** The existing
   `validateCoachEmails.ts` filter applies to every new write.
4. **Resume-safe.** Every script accepts `--resume` and skips entries whose
   `lastVerified` is within the freshness window (default 180 days).
5. **Drift detection.** On every run, 5% of existing `success`-status entries
   are re-checked against live sources. Any mismatch downgrades confidence
   and is logged to `server/data/scraperDrift.log` for review.

## Storage and Downstream Use

New JSON files (`programRecords.json`, `recruitingClasses.json`) live next to
existing data files. They are joined into the school object at read time by
`server/lib/schoolMatcher.ts` and friends — no schema migration is required
in `schools.json` itself. A follow-up Supabase upsert can be added to
`seedSchools.ts` once the data files stabilize.

## Cost Plan

| Phase | Best | Worst |
|---|---|---|
| `fillCoachGaps` Pass 1 (Haiku) | $1 | $2 |
| `fillCoachGaps` Pass 2 (Sonnet) | $4 | $7 |
| `scrapeRecord` | $0 | $0 |
| `scrapeRecruitingClass` Sources 1–2 | $0 | $0 |
| `scrapeRecruitingClass` Source 3 (Sonnet fallback) | $5 | $7 |
| **Total** | **$10** | **$16** |

Both cases stay under the $20 cap. The hard cap stops execution past $20
even if the budget estimate is wrong.

## Risk Notes

- **TopDrawerSoccer terms.** Their commit lists are public but scraping at
  scale may run afoul of ToS. Throttle aggressively; do not republish raw
  data; treat as one input among several.
- **NCAA stats API stability.** `data.ncaa.com` is a public but undocumented
  feed. URL patterns can change between seasons. The script must log and
  skip on 404 rather than fail the whole run.
- **Recruiting class confidence.** Source 3 (LLM) will sometimes be wrong
  about commits. Tagging `confidence: low` and exposing it in the UI matters
  more than blocking that data from the file.
- **NAIA and JUCO out of scope.** Athletes targeting those divisions get
  the existing fields only. Documented user-facing limitation.
