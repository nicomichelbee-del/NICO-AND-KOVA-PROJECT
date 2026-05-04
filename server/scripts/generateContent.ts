/**
 * Generate KickrIo TikTok + Instagram drafts.
 *
 * Usage:
 *   npx tsx server/scripts/generateContent.ts                     # 3 drafts, mixed features
 *   npx tsx server/scripts/generateContent.ts --count=5
 *   npx tsx server/scripts/generateContent.ts --feature="video rater"
 *
 * Output:
 *   server/data/content/YYYY-MM-DD/draft-N.md   ← one markdown brief per draft
 *   server/data/content/YYYY-MM-DD/index.json   ← raw data for programmatic use
 *   server/data/content/YYYY-MM-DD/README.md    ← batch overview + posting checklist
 *
 * Requires ANTHROPIC_API_KEY in .env.
 */

import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { generateDrafts, renderDraftMarkdown, TrendingSound } from '../lib/contentAgent'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
)

const COUNT = args.count ? parseInt(args.count, 10) : 3
const FEATURE = args.feature && args.feature !== 'true' ? args.feature : undefined

function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function main() {
  console.log(`[content] generating ${COUNT} drafts${FEATURE ? ` focused on "${FEATURE}"` : ''}`)

  const drafts = await generateDrafts({ count: COUNT, focusFeature: FEATURE })

  const stamp = todayStamp()
  const outDir = path.join(__dirname, '..', 'data', 'content', stamp)
  fs.mkdirSync(outDir, { recursive: true })

  // Load sounds for enriching markdown rendering
  const soundsFile = path.join(__dirname, '..', 'data', 'trendingSounds.json')
  const soundsRaw = JSON.parse(fs.readFileSync(soundsFile, 'utf-8'))
  const soundsById = new Map<string, TrendingSound>()
  for (const s of soundsRaw.sounds as TrendingSound[]) soundsById.set(s.id, s)

  // Per-draft markdown
  for (const d of drafts) {
    const sound = soundsById.get(d.suggestedSound?.soundId)
    const md = renderDraftMarkdown(d, sound)
    fs.writeFileSync(path.join(outDir, `draft-${d.draftNumber}.md`), md, 'utf-8')
  }

  // Raw JSON
  fs.writeFileSync(
    path.join(outDir, 'index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), feature: FEATURE ?? null, drafts }, null, 2),
    'utf-8',
  )

  // README batch overview
  const readme: string[] = []
  readme.push(`# KickrIo content batch — ${stamp}`)
  readme.push('')
  readme.push(`${drafts.length} drafts ready to post.${FEATURE ? ` Focus: ${FEATURE}.` : ''}`)
  readme.push('')
  readme.push(`## Posting checklist`)
  readme.push('')
  for (const d of drafts) {
    readme.push(`- [ ] **Draft ${d.draftNumber}** (${d.format}, ${d.audience}) — ${d.angle}`)
    readme.push(`  - Sound: \`${d.suggestedSound.soundId}\` — ${d.suggestedSound.soundTitle}`)
    readme.push(`  - Best time: ${d.postingNotes.bestTime}`)
  }
  readme.push('')
  readme.push(`## How to post`)
  readme.push('')
  readme.push(`1. Open the per-draft \`draft-N.md\` brief.`)
  readme.push(`2. Film or screen-record the shot list items.`)
  readme.push(`3. Edit in CapCut or InShot — drop in the on-screen text at the listed timecodes.`)
  readme.push(`4. Open TikTok / Instagram → upload the cut → search the suggested sound by name → attach.`)
  readme.push(`5. Paste the platform-specific caption + hashtags from the brief.`)
  readme.push(`6. Set the cover frame per the brief's advice.`)
  readme.push(`7. Post at the listed best time.`)
  readme.push('')
  readme.push(`> **Why no auto-post?** TikTok & IG require platform-licensed audio to be picked inside the native app — a third-party cannot attach trending sounds via API without losing the licensed-audio reach boost. Manual upload takes ~10 sec per post and gets meaningfully better distribution.`)
  fs.writeFileSync(path.join(outDir, 'README.md'), readme.join('\n'), 'utf-8')

  console.log(`[content] wrote ${drafts.length} drafts to ${outDir}`)
  console.log(`[content] start with: ${path.join(outDir, 'README.md')}`)
}

main().catch((err) => {
  console.error('[content] failed:', err)
  process.exit(1)
})
