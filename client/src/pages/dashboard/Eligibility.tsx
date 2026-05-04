import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import type { AthleteProfile, Division } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

// ── Eligibility checklist ────────────────────────────────────────────────────
// The required steps depend on the athlete's target division. D1/D2 must register
// with the NCAA Eligibility Center; D3/NAIA/JUCO have lighter or different paths.
type Phase = 'sophomore' | 'junior' | 'senior' | 'ongoing'

interface Step {
  id: string
  title: string
  why: string
  link?: { url: string; label: string }
  phase: Phase
  divisions: Division[]
}

const STEPS: Step[] = [
  {
    id: 'create-eligibility-account',
    title: 'Create NCAA Eligibility Center account',
    why: 'Required for every D1 and D2 athlete. Free to create — payment is only due at certification.',
    link: { url: 'https://web3.ncaa.org/ecwr3/', label: 'eligibilitycenter.org' },
    phase: 'sophomore',
    divisions: ['D1', 'D2'],
  },
  {
    id: 'submit-transcript-9-10',
    title: 'Submit 9th–10th grade transcript to Eligibility Center',
    why: "Counselor sends the official transcript through your high school's portal.",
    phase: 'sophomore',
    divisions: ['D1', 'D2'],
  },
  {
    id: 'core-course-tracker',
    title: 'Lock in 16 NCAA-approved core courses',
    why: 'D1 needs 10 of 16 completed by start of senior year. Confirm each course with your counselor against your school\'s NCAA list.',
    link: { url: 'https://web3.ncaa.org/ecwr3/', label: 'High school core list lookup' },
    phase: 'sophomore',
    divisions: ['D1', 'D2'],
  },
  {
    id: 'sat-act',
    title: 'Take SAT or ACT (use code 9999 to send NCAA scores)',
    why: 'Test-optional for many schools but coaches still ask. Sending to 9999 routes scores directly to the Eligibility Center.',
    phase: 'junior',
    divisions: ['D1', 'D2', 'D3', 'NAIA'],
  },
  {
    id: 'amateurism',
    title: 'Complete amateurism questionnaire',
    why: 'Confirms you have not received compensation for play. Required before you can compete in D1 or D2.',
    phase: 'senior',
    divisions: ['D1', 'D2'],
  },
  {
    id: 'final-transcript',
    title: 'Submit final transcript after graduation',
    why: 'Last step before final certification. Your counselor sends it.',
    phase: 'senior',
    divisions: ['D1', 'D2'],
  },
  {
    id: 'naia-portal',
    title: 'Register with NAIA PlayNAIA portal',
    why: 'NAIA equivalent of the Eligibility Center. Required to compete at any NAIA program.',
    link: { url: 'https://play.mynaia.org/', label: 'play.mynaia.org' },
    phase: 'junior',
    divisions: ['NAIA'],
  },
  {
    id: 'd3-direct-admissions',
    title: 'Apply directly to schools (D3 has no central registry)',
    why: 'D3 schools cannot offer athletic scholarships, so admission and academic aid are negotiated school-by-school.',
    phase: 'senior',
    divisions: ['D3'],
  },
  {
    id: 'juco-eligibility',
    title: 'Confirm NJCAA / Cal-JC eligibility through your target school',
    why: 'JUCO eligibility runs through each conference, not a central registry. Coach handles paperwork once you commit.',
    phase: 'senior',
    divisions: ['JUCO'],
  },
  {
    id: 'unofficial-visit',
    title: 'Schedule unofficial visit at top 3 programs',
    why: 'Walk the campus, see a training session, meet the staff. Costs you nothing, signals serious interest.',
    phase: 'ongoing',
    divisions: ['D1', 'D2', 'D3', 'NAIA', 'JUCO'],
  },
  {
    id: 'official-visit',
    title: 'Take an official visit (D1 = sr year max 5, D2 = unlimited)',
    why: 'Paid for by the school. Signals real interest from the coach. Track every offer in writing.',
    phase: 'senior',
    divisions: ['D1', 'D2'],
  },
]

// ── Document vault ──────────────────────────────────────────────────────────
// Stores user-pasted shareable links (Google Drive, Dropbox, etc.) rather than
// hosting files ourselves — keeps storage free and avoids a Supabase Storage
// bucket setup. Categories cover the docs coaches most often request.
type DocCategory = 'transcript' | 'test_score' | 'eligibility' | 'highlight' | 'recommendation' | 'other'

interface VaultDoc {
  id: string
  title: string
  category: DocCategory
  url: string
  addedAt: string
}

const CATEGORY_LABELS: Record<DocCategory, string> = {
  transcript: 'Transcript',
  test_score: 'SAT / ACT score report',
  eligibility: 'Eligibility Center confirmation',
  highlight: 'Highlight reel',
  recommendation: 'Coach recommendation',
  other: 'Other',
}

const CATEGORY_HINT: Record<DocCategory, string> = {
  transcript: 'Coaches request this constantly. Get a clean PDF from your registrar.',
  test_score: 'Even at test-optional schools, a strong score helps unlock academic aid.',
  eligibility: 'Once Certified, screenshot the Eligibility Center status page and link it here.',
  highlight: 'Public YouTube or Hudl link works best.',
  recommendation: 'A short PDF letter from your club coach is the gold standard.',
  other: 'Anything else a coach has asked for — résumé, NCAA core list, etc.',
}

const STORAGE_CHECKS = 'kr_eligibility_checks_v1'
const STORAGE_VAULT = 'kr_eligibility_vault_v1'

function loadChecks(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_CHECKS) ?? '{}') } catch { return {} }
}
function saveChecks(c: Record<string, boolean>) {
  localStorage.setItem(STORAGE_CHECKS, JSON.stringify(c))
}
function loadVault(): VaultDoc[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_VAULT) ?? '[]') } catch { return [] }
}
function saveVault(v: VaultDoc[]) {
  localStorage.setItem(STORAGE_VAULT, JSON.stringify(v))
}

const PHASE_LABEL: Record<Phase, string> = {
  sophomore: 'Sophomore year',
  junior: 'Junior year',
  senior: 'Senior year',
  ongoing: 'Ongoing',
}

export function Eligibility() {
  const profile = getProfile()
  const division: Division = profile?.targetDivision ?? 'D1'

  const [checks, setChecks] = useState<Record<string, boolean>>(loadChecks)
  const [vault, setVault] = useState<VaultDoc[]>(loadVault)
  const [showAdd, setShowAdd] = useState(false)
  const [newDoc, setNewDoc] = useState<{ title: string; url: string; category: DocCategory }>({
    title: '', url: '', category: 'transcript',
  })

  const relevantSteps = useMemo(
    () => STEPS.filter((s) => s.divisions.includes(division)),
    [division],
  )

  const grouped = useMemo(() => {
    const out: Record<Phase, Step[]> = { sophomore: [], junior: [], senior: [], ongoing: [] }
    for (const s of relevantSteps) out[s.phase].push(s)
    return out
  }, [relevantSteps])

  const completed = relevantSteps.filter((s) => checks[s.id]).length
  const pct = relevantSteps.length > 0 ? Math.round((completed / relevantSteps.length) * 100) : 0

  function toggleCheck(id: string) {
    const next = { ...checks, [id]: !checks[id] }
    setChecks(next); saveChecks(next)
  }

  function addDoc() {
    if (!newDoc.title.trim() || !newDoc.url.trim()) return
    const doc: VaultDoc = {
      id: `doc-${Date.now()}`,
      title: newDoc.title.trim(),
      category: newDoc.category,
      url: newDoc.url.trim(),
      addedAt: new Date().toISOString(),
    }
    const next = [doc, ...vault]
    setVault(next); saveVault(next)
    setNewDoc({ title: '', url: '', category: 'transcript' })
    setShowAdd(false)
  }

  function removeDoc(id: string) {
    const next = vault.filter((d) => d.id !== id)
    setVault(next); saveVault(next)
  }

  return (
    <div className="kr-page max-w-5xl">
      <PageHeader
        eyebrow="Eligibility"
        title={<>NCAA Eligibility &amp; <span className="kr-accent">document vault</span>.</>}
        lede="Tailored to your target division. The steps coaches expect you to have done — checked off and ready to share."
      />

      {/* Progress + division banner */}
      <Card className="p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#9a9385] mb-1">
            Target division · {division}
          </div>
          <div className="text-sm text-[#f5f1e8]">
            {completed} of {relevantSteps.length} steps complete
          </div>
        </div>
        <div className="flex-1 max-w-sm min-w-[200px]">
          <div className="h-2 rounded-full bg-[rgba(245,241,232,0.06)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#f0b65a] to-[#e09a3a] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-right text-xs text-[#9a9385] mt-1 font-mono">{pct}%</div>
        </div>
      </Card>

      {/* Checklist by phase */}
      <div className="flex flex-col gap-6 mb-10">
        {(['sophomore', 'junior', 'senior', 'ongoing'] as Phase[]).map((phase) => {
          const items = grouped[phase]
          if (items.length === 0) return null
          return (
            <div key={phase}>
              <div className="text-[10.5px] font-mono uppercase tracking-[0.22em] text-[#9a9385] mb-3 px-1">
                {PHASE_LABEL[phase]}
              </div>
              <Card>
                <ul className="divide-y divide-[rgba(245,241,232,0.06)]">
                  {items.map((step) => {
                    const done = !!checks[step.id]
                    return (
                      <li key={step.id} className="px-5 py-4 flex items-start gap-4">
                        <button
                          onClick={() => toggleCheck(step.id)}
                          aria-label={done ? 'Mark as not done' : 'Mark as done'}
                          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            done
                              ? 'bg-[#f0b65a] border-[#f0b65a] text-black'
                              : 'border-[rgba(245,241,232,0.20)] hover:border-[#f0b65a]'
                          }`}
                        >
                          {done && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12l4.5 4.5L19 7" />
                            </svg>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${done ? 'text-[#9a9385] line-through' : 'text-[#f5f1e8]'}`}>
                            {step.title}
                          </div>
                          <div className="text-xs text-[#9a9385] mt-1 leading-relaxed">{step.why}</div>
                          {step.link && (
                            <a
                              href={step.link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block mt-2 text-xs font-mono uppercase tracking-[0.16em] text-[#f0b65a] hover:underline underline-offset-4"
                            >
                              {step.link.label} ↗
                            </a>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </div>
          )
        })}
      </div>

      {/* Document vault */}
      <div className="mb-2 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10.5px] font-mono uppercase tracking-[0.22em] text-[#9a9385]">
            Document vault
          </div>
          <div className="text-sm text-[#f5f1e8] mt-1">
            One link per document. Paste any shareable URL — Google Drive, Dropbox, YouTube.
          </div>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Add document'}</Button>
      </div>

      {showAdd && (
        <Card className="p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-[#9a9385] block mb-1.5">Category</label>
              <select
                value={newDoc.category}
                onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value as DocCategory })}
                className="w-full bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.10)] rounded text-xs text-[#f5f1e8] px-3 py-2 focus:outline-none focus:border-[#f0b65a]"
              >
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <div className="text-[11px] text-[#9a9385] mt-1.5 leading-relaxed">{CATEGORY_HINT[newDoc.category]}</div>
            </div>
            <Input
              label="Title"
              value={newDoc.title}
              onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
              placeholder="e.g. Sophomore transcript (Fall 2025)"
            />
            <Input
              label="Shareable URL"
              value={newDoc.url}
              onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
              placeholder="https://drive.google.com/..."
            />
          </div>
          <Button onClick={addDoc} className="mt-4" disabled={!newDoc.title.trim() || !newDoc.url.trim()}>
            Save document
          </Button>
        </Card>
      )}

      {vault.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-3xl mb-3">📂</div>
          <div className="font-serif text-base font-bold text-[#f5f1e8] mb-1">No documents yet</div>
          <p className="text-xs text-[#9a9385] max-w-sm mx-auto">
            When a coach asks for your transcript, test scores, or NCAA confirmation, you'll have the link ready in seconds.
          </p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-[rgba(245,241,232,0.06)]">
            {vault.map((doc) => (
              <li key={doc.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#f5f1e8] truncate">{doc.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] border border-[rgba(245,241,232,0.10)] text-[#f0b65a] font-mono uppercase tracking-wider">
                      {CATEGORY_LABELS[doc.category]}
                    </span>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#60a5fa] hover:underline underline-offset-4 truncate inline-block mt-1 max-w-full"
                  >
                    {doc.url}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(doc.url)}
                    className="text-xs font-mono uppercase tracking-wider text-[#9a9385] hover:text-[#f0b65a] transition-colors"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => removeDoc(doc.id)}
                    className="text-xs font-mono uppercase tracking-wider text-[#9a9385] hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
