/**
 * verifyDisagreements.ts — Phase 2 of the program-existence accuracy plan.
 *
 * Reads server/data/programDisagreements.json (produced by
 * findProgramDisagreements.ts) and asks Claude to verify each disagreement
 * with a YES/NO answer. Output goes to server/data/programVerifications.json,
 * which is consumed by the matcher with priority:
 *
 *     manual override > AI verification > Wikipedia > coach-status fallback
 *
 * For NCAA program existence we use the model's training knowledge — these
 * are stable, well-documented facts (Alabama has women's varsity soccer but
 * not men's; UCLA has both; etc.). One batched call covers ~100 disagreements
 * cheaply with Haiku. If the user reports a still-wrong result for a known
 * recent change (e.g., a school just announced a program), the manual
 * override file is the escape hatch.
 *
 * Run:
 *   npx tsx server/scripts/verifyDisagreements.ts
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'

interface Disagreement {
  key: string
  schoolName: string
  division: string
  gender: 'mens' | 'womens'
  scraperStatus: string
  scraperCoachName: string
  wikiSays: boolean | undefined
  reason: string
}

interface DisagreementFile {
  falsePositives: Disagreement[]
  falseNegatives: Disagreement[]
  lowerDivPositives: Disagreement[]
  lowerDivNoProgram: Disagreement[]
}

const DATA_DIR = path.join(__dirname, '..', 'data')
const DISAGREEMENTS_PATH = path.join(DATA_DIR, 'programDisagreements.json')
const OUT_PATH = path.join(DATA_DIR, 'programVerifications.json')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
const MODEL = 'claude-haiku-4-5'

// Verify in chunks of 40 so the model has room to reason about each entry
// without truncating the response. 97 disagreements × 1 chunk would push
// past max_tokens; 40 per chunk keeps each response well under the limit.
const CHUNK_SIZE = 40

interface VerificationResult {
  hasProgram: boolean
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

function buildPrompt(items: Disagreement[]): string {
  const lines = items
    .map((d, i) => `${i + 1}. ${d.schoolName} (${d.division}) — ${d.gender === 'mens' ? "men's" : "women's"} varsity soccer?`)
    .join('\n')
  return `You are verifying whether NCAA member schools field varsity soccer programs of a given gender. Use your training-data knowledge of D1 / D2 / D3 / NAIA / NJCAA athletics. Be strict: "varsity" means a fully-funded NCAA-recognized program, not club, intramural, or co-ed.

For each numbered school below, respond on its own line in this EXACT format:

  <number>. <YES|NO> | <high|medium|low> | <one-sentence reason>

- YES = the school fields a varsity program of the requested gender at the listed division as of the 2024-25 academic year.
- NO  = the school does NOT field such a varsity program (e.g., football schools without men's soccer like Alabama / Georgia / Texas / etc.; recently dropped programs).
- Confidence "high" = you are certain (well-known program existence/absence). "medium" = you have moderate confidence. "low" = you are unsure.

Schools to verify:
${lines}

Respond with EXACTLY one line per school in the format above. No preamble, no extra commentary.`
}

function parseResponse(text: string, items: Disagreement[]): Map<string, VerificationResult> {
  const out = new Map<string, VerificationResult>()
  const lines = text.split('\n')
  for (const raw of lines) {
    const m = raw.match(/^\s*(\d+)\.\s*(YES|NO)\s*\|\s*(high|medium|low)\s*\|\s*(.+)$/i)
    if (!m) continue
    const idx = Number(m[1]) - 1
    if (idx < 0 || idx >= items.length) continue
    const item = items[idx]
    out.set(item.key, {
      hasProgram: m[2].toUpperCase() === 'YES',
      confidence: m[3].toLowerCase() as 'high' | 'medium' | 'low',
      reason: m[4].trim(),
    })
  }
  return out
}

async function verifyChunk(items: Disagreement[]): Promise<Map<string, VerificationResult>> {
  const prompt = buildPrompt(items)
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return parseResponse(block.text, items)
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set in environment.')
    process.exit(1)
  }
  const disagreements = JSON.parse(fs.readFileSync(DISAGREEMENTS_PATH, 'utf8')) as DisagreementFile

  // Verify Type A (false positives — user's main complaint) and Type B (false
  // negatives — Wikipedia gaps the scraper caught). Skip lower-div entries
  // for now — those still rely on the scraper + override path until Phase 3.
  const queue = [...disagreements.falsePositives, ...disagreements.falseNegatives]

  console.log(`Verifying ${queue.length} disagreements via ${MODEL}…`)
  console.log(`Estimated cost: ~$${(queue.length * 0.005).toFixed(2)}`)

  const allResults = new Map<string, VerificationResult>()
  for (let i = 0; i < queue.length; i += CHUNK_SIZE) {
    const chunk = queue.slice(i, i + CHUNK_SIZE)
    process.stdout.write(`  chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(queue.length / CHUNK_SIZE)} (${chunk.length} items)…`)
    const results = await verifyChunk(chunk)
    for (const [k, v] of results) allResults.set(k, v)
    console.log(` ✓ (${results.size}/${chunk.length} parsed)`)
  }

  // Compose the output. Manual review surface: for each disagreement,
  // include both the AI verdict and the original signals so a human can
  // sanity-check what's flipping.
  const out: Record<string, unknown> = {
    _meta: {
      generatedAt: new Date().toISOString(),
      model: MODEL,
      totalChecked: queue.length,
      totalVerified: allResults.size,
    },
  }

  let flipsToYes = 0
  let flipsToNo = 0
  let agrees = 0
  for (const d of queue) {
    const v = allResults.get(d.key)
    if (!v) continue
    out[d.key] = {
      hasProgram: v.hasProgram,
      confidence: v.confidence,
      reason: v.reason,
      // Audit trail: what we knew before the verification.
      previously: {
        wikipedia: d.wikiSays,
        scraperStatus: d.scraperStatus,
        scraperCoachName: d.scraperCoachName,
      },
    }
    // Tally how the AI verdict relates to the previous signals.
    if (v.hasProgram === true && d.wikiSays === false) flipsToYes++
    else if (v.hasProgram === false && d.wikiSays === true) flipsToNo++
    else agrees++
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n')
  console.log(`\nWrote ${OUT_PATH}`)
  console.log(`  Flipped to YES (Wikipedia gap fixed): ${flipsToYes}`)
  console.log(`  Flipped to NO (scraper false positive confirmed): ${flipsToNo}`)
  console.log(`  Agrees with previous signals:          ${agrees}`)
}

main().catch((e) => {
  console.error('verifyDisagreements failed:', e)
  process.exit(1)
})
