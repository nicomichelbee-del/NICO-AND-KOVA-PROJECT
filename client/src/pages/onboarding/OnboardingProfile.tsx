import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useProfile } from '../../context/ProfileContext'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { KickrIQLogo } from '../../components/ui/KickrIQLogo'
import {
  DIVISION_TARGET_LABELS,
  type AthleteProfileRecord,
  type DivisionTarget,
} from '../../types/profile'
import { PitchPositionPicker } from '../../components/profile/PitchPositionPicker'

type StepKey = 'basics' | 'soccer' | 'academics' | 'goals' | 'video'

const STEPS: { key: StepKey; label: string; blurb: string; eyebrow: string }[] = [
  { key: 'basics',    label: 'Basics',         blurb: "The essentials coaches see first.",                      eyebrow: 'Step one — name on the door' },
  { key: 'soccer',    label: 'Soccer',         blurb: 'Position, foot, club. The on-field picture.',            eyebrow: 'Step two — your game' },
  { key: 'academics', label: 'Academics',      blurb: 'GPA and test scores filter your school matches.',        eyebrow: 'Step three — the gradebook' },
  { key: 'goals',     label: 'College goals',  blurb: "Divisions and regions you'd play in.",                   eyebrow: 'Step four — the target' },
  { key: 'video',     label: 'Highlight video',blurb: "A reel link makes your profile shareable.",              eyebrow: 'Step five — the proof' },
]

const REGIONS = ['Northeast', 'Southeast', 'Midwest', 'South', 'Southwest', 'West', 'Northwest']

const FOOT_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
]

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

function computeStrength(p: Partial<AthleteProfileRecord>): number {
  const checks: boolean[] = [
    !!p.full_name,
    !!p.graduation_year,
    !!p.high_school_name,
    !!p.primary_position,
    !!p.preferred_foot,
    !!p.current_club,
    !!p.current_league_or_division,
    p.gpa != null,
    !!(p.sat_score || p.act_score),
    (p.desired_division_levels?.length ?? 0) > 0,
    (p.regions_of_interest?.length ?? 0) > 0,
    !!p.highlight_video_url,
  ]
  const hits = checks.filter(Boolean).length
  return Math.round((hits / checks.length) * 100)
}

export function OnboardingProfile() {
  const { profile, saveDraft, loading } = useProfile()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isEdit = params.get('edit') === '1'

  const [stepIdx, setStepIdx] = useState(0)
  const [form, setForm] = useState<Partial<AthleteProfileRecord>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setForm((prev) => ({ ...profile, ...prev }))
    }
  }, [profile])

  // Returning users with a completed profile shouldn't see onboarding unless
  // they explicitly clicked "Edit profile" (?edit=1).
  useEffect(() => {
    if (!loading && !isEdit && profile?.profile_completed) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, isEdit, profile?.profile_completed, navigate])

  const step = STEPS[stepIdx]
  const isLast = stepIdx === STEPS.length - 1

  const stepValid = useMemo(() => {
    if (step.key === 'basics') {
      return !!form.full_name && !!form.graduation_year && !!form.high_school_name
    }
    if (step.key === 'soccer') {
      return !!form.primary_position && !!form.preferred_foot && !!form.current_club && !!form.current_league_or_division
    }
    if (step.key === 'academics') {
      return form.gpa != null
    }
    if (step.key === 'goals') {
      return (form.desired_division_levels?.length ?? 0) > 0 && (form.regions_of_interest?.length ?? 0) > 0
    }
    if (step.key === 'video') {
      return !!form.highlight_video_url
    }
    return true
  }, [step.key, form])

  function update<K extends keyof AthleteProfileRecord>(key: K, value: AthleteProfileRecord[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleArray(key: 'desired_division_levels' | 'regions_of_interest', value: string) {
    setForm((prev) => {
      const current = (prev[key] as string[] | undefined) ?? []
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  async function next() {
    setError(null)
    if (!stepValid) {
      setError('Fill out the highlighted fields before continuing.')
      return
    }
    await saveDraft(form)
    if (isLast) {
      await finish()
    } else {
      setStepIdx((i) => i + 1)
    }
  }

  async function back() {
    setError(null)
    if (stepIdx === 0) return
    setStepIdx((i) => i - 1)
  }

  async function finish() {
    setSubmitting(true)
    try {
      const slug = form.slug || (form.full_name ? `${slugify(form.full_name)}-${(form.graduation_year ?? '').toString().slice(-2)}` : null)
      const strength = computeStrength(form)
      await saveDraft({
        ...form,
        slug,
        profile_strength_score: strength,
        profile_completed: true,
      })
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving your profile.')
    } finally {
      setSubmitting(false)
    }
  }

  async function skip() {
    setSubmitting(true)
    try {
      const slug = form.slug || (form.full_name ? `${slugify(form.full_name)}-${(form.graduation_year ?? '').toString().slice(-2)}` : null)
      const strength = computeStrength(form)
      await saveDraft({
        ...form,
        slug,
        profile_strength_score: strength,
        profile_completed: true,
      })
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong saving your progress.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="kr-auth-shell flex items-center justify-center">
        <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-gold">Loading…</div>
      </div>
    )
  }

  const progressPct = ((stepIdx + 1) / STEPS.length) * 100

  return (
    <div className="kr-auth-shell">
      <div className="relative max-w-3xl mx-auto px-6 py-10 md:py-14">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="no-underline">
            <KickrIQLogo height={26} />
          </Link>
          <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-2">
            {isEdit ? 'Edit profile' : 'Onboarding'} · <span className="text-gold">{stepIdx + 1}</span> / {STEPS.length}
          </div>
        </div>

        {/* Progress + step pips */}
        <div className="mb-10">
          <div className="h-[3px] bg-[rgba(245,241,232,0.06)] rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-[linear-gradient(90deg,var(--gold-3),var(--gold))] transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] uppercase">
            {STEPS.map((s, i) => (
              <span
                key={s.key}
                className={
                  i < stepIdx ? 'text-ink-2' :
                  i === stepIdx ? 'text-gold' :
                  'text-ink-3'
                }
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Step header */}
        <div className="mb-9" key={step.key} data-reveal-on-load>
          <span className="kr-eyebrow mb-3">{step.eyebrow}</span>
          <h1 className="kr-h1 mt-3">
            {step.label === 'College goals' ? <>College <span className="kr-accent">goals</span></> :
             step.label === 'Highlight video' ? <>Highlight <span className="kr-accent">video</span></> :
             step.label === 'Academics' ? <>The <span className="kr-accent">gradebook</span></> :
             step.label === 'Soccer' ? <>Your <span className="kr-accent">game</span></> :
             <>The <span className="kr-accent">basics</span></>}
          </h1>
          <p className="text-[15px] text-ink-1 mt-2">{step.blurb}</p>
        </div>

        <div className="kr-panel">
          <div className="space-y-6">
            {step.key === 'basics' && (
              <>
                <Input label="Full name" placeholder="Alex Morgan" value={form.full_name ?? ''} onChange={(e) => update('full_name', e.target.value)} />
                <Input label="Graduation year" type="number" inputMode="numeric" placeholder="2027" min={2024} max={2032} value={form.graduation_year ?? ''} onChange={(e) => update('graduation_year', e.target.value ? Number(e.target.value) : null)} />
                <Input label="High school" placeholder="Lincoln High School" value={form.high_school_name ?? ''} onChange={(e) => update('high_school_name', e.target.value)} />
              </>
            )}

            {step.key === 'soccer' && (
              <>
                <FieldLabel>Position on the pitch</FieldLabel>
                <PitchPositionPicker
                  primary={form.primary_position ?? null}
                  secondary={form.secondary_position ?? null}
                  onPickPrimary={(code) => update('primary_position', code)}
                  onPickSecondary={(code) => update('secondary_position', code)}
                />

                <FieldLabel>Preferred foot</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {FOOT_OPTIONS.map((f) => (
                    <Chip key={f.value} active={form.preferred_foot === f.value} onClick={() => update('preferred_foot', f.value)}>
                      <span className="font-medium">{f.label}</span>
                    </Chip>
                  ))}
                </div>

                <Input label="Club team" placeholder="Bay Area Surf" value={form.current_club ?? ''} onChange={(e) => update('current_club', e.target.value)} />
                <Input label="League or division" placeholder="ECNL, MLS Next, NPL, etc." value={form.current_league_or_division ?? ''} onChange={(e) => update('current_league_or_division', e.target.value)} />
              </>
            )}

            {step.key === 'academics' && (
              <>
                <Input label="GPA (unweighted)" type="number" inputMode="decimal" step="0.01" placeholder="3.75" min={0} max={5} value={form.gpa ?? ''} onChange={(e) => update('gpa', e.target.value ? Number(e.target.value) : null)} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="SAT (optional)" type="number" inputMode="numeric" placeholder="1280" min={400} max={1600} value={form.sat_score ?? ''} onChange={(e) => update('sat_score', e.target.value || null)} />
                  <Input label="ACT (optional)" type="number" inputMode="numeric" placeholder="28" min={1} max={36} value={form.act_score ?? ''} onChange={(e) => update('act_score', e.target.value || null)} />
                </div>
                <Input label="NCAA Eligibility ID (optional)" placeholder="If you've registered with the NCAA Eligibility Center" value={form.ncaa_eligibility_id ?? ''} onChange={(e) => update('ncaa_eligibility_id', e.target.value || null)} />
                <p className="text-xs text-ink-3 leading-[1.6]">
                  D1 and D2 athletes must register with the NCAA Eligibility Center. You can add this later.
                </p>
              </>
            )}

            {step.key === 'goals' && (
              <>
                <FieldLabel>Target divisions</FieldLabel>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(Object.keys(DIVISION_TARGET_LABELS) as DivisionTarget[]).map((d) => (
                    <Chip key={d} active={(form.desired_division_levels ?? []).includes(d)} onClick={() => toggleArray('desired_division_levels', d)}>
                      <span className="block font-mono text-[12px] tracking-[0.10em] font-semibold">{d}</span>
                      <span className="block text-[10px] text-ink-3 mt-1">{DIVISION_TARGET_LABELS[d]}</span>
                    </Chip>
                  ))}
                </div>

                <FieldLabel>Regions you'd consider</FieldLabel>
                <div className="grid grid-cols-1 gap-2">
                  <Chip
                    active={(form.regions_of_interest?.length ?? 0) === REGIONS.length}
                    onClick={() => update('regions_of_interest', (form.regions_of_interest?.length ?? 0) === REGIONS.length ? [] : [...REGIONS])}
                  >
                    Any region — open to all
                  </Chip>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {REGIONS.map((r) => (
                    <Chip key={r} active={(form.regions_of_interest ?? []).includes(r)} onClick={() => toggleArray('regions_of_interest', r)}>
                      {r}
                    </Chip>
                  ))}
                </div>
              </>
            )}

            {step.key === 'video' && (
              <>
                <Input label="Highlight video URL" placeholder="https://youtube.com/watch?v=..." value={form.highlight_video_url ?? ''} onChange={(e) => update('highlight_video_url', e.target.value)} />
                <p className="text-xs text-ink-3 leading-[1.6]">
                  Don't have one yet? Paste a placeholder and update it later — the Highlight Video Rater (Pro)
                  will help you cut a 3–5 minute reel that opens with your best clip.
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-6 p-3 rounded-lg bg-[rgba(227,90,90,0.08)] border border-[rgba(227,90,90,0.28)] text-sm text-crimson-light">
              {error}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between mt-8 pt-6">
          <button
            onClick={back}
            disabled={stepIdx === 0}
            className="text-sm text-ink-2 hover:text-ink-0 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-4">
            {!isLast && !isEdit && (
              <button
                onClick={skip}
                disabled={submitting}
                className="text-sm text-ink-2 hover:text-ink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip for now
              </button>
            )}
            <Button onClick={next} disabled={submitting}>
              {submitting ? 'Saving…' : isLast ? (isEdit ? 'Save changes' : 'Finish profile') : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 mt-2">
      {children}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-3 rounded-xl border text-center transition-[border-color,background,color,box-shadow] duration-150 ${
        active
          ? 'bg-[rgba(240,182,90,0.10)] border-[rgba(240,182,90,0.55)] text-ink-0 shadow-[0_0_0_3px_rgba(240,182,90,0.10)]'
          : 'bg-[rgba(245,241,232,0.02)] border-[rgba(245,241,232,0.10)] text-ink-1 hover:border-[rgba(240,182,90,0.40)] hover:text-ink-0'
      }`}
    >
      {children}
    </button>
  )
}
