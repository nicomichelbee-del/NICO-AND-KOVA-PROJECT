import { useEffect, useState } from 'react'
import { useProfile } from '../../context/ProfileContext'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/PageHeader'
import { PitchPositionPicker } from '../../components/profile/PitchPositionPicker'
import {
  DIVISION_TARGET_LABELS,
  type ProfileVisibility,
  type AthleteProfileRecord,
} from '../../types/profile'

const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string; hint: string }[] = [
  { value: 'public', label: 'Public', hint: 'Anyone with the link can view your profile.' },
  { value: 'recruiters_only', label: 'Recruiters only', hint: 'Signed-in coaches and scouts only.' },
  { value: 'private', label: 'Private', hint: 'Only you can view your profile.' },
]

const FOOT_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
]

const REGIONS = ['Northeast', 'Southeast', 'Midwest', 'South', 'Southwest', 'West', 'Northwest']

const ACADEMIC_TIER_OPTIONS: { value: 1 | 2 | 3 | 4 | 5 | null; label: string; detail: string }[] = [
  { value: 1,    label: 'Top tier only',         detail: 'Roughly top-25 selectivity (Ivy / Stanford / Duke caliber).' },
  { value: 2,    label: 'Highly selective+',     detail: 'Roughly top-50. Includes flagship publics like UNC, UVA.' },
  { value: 3,    label: 'Selective+',            detail: 'Roughly top-100. Most flagship state schools.' },
  { value: 4,    label: 'Moderately selective+', detail: 'Excludes only open-admission programs.' },
  { value: null, label: 'No preference',         detail: 'Show every match regardless of academic tier.' },
]

// Build the grad-year chip list: the four current high-school classes plus
// next year's incoming freshman (rising 9th graders planning ahead).
// Academic year flips in September, so before Sep we're still in the previous one.
function buildGradYearOptions(): { year: number; label: string }[] {
  const now = new Date()
  const academicYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  // Current senior graduates at academicYear + 1.
  const seniorYear = academicYear + 1
  return [
    { year: seniorYear,     label: 'Senior' },
    { year: seniorYear + 1, label: 'Junior' },
    { year: seniorYear + 2, label: 'Sophomore' },
    { year: seniorYear + 3, label: 'Freshman' },
    { year: seniorYear + 4, label: '8th grade' },
  ]
}

function computeStrength(p: Partial<AthleteProfileRecord>): number {
  const checks: boolean[] = [
    !!p.full_name,
    !!p.graduation_year,
    !!p.high_school_name,
    !!p.gender,
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

export function Profile() {
  const { profile, saveDraft, loading } = useProfile()
  const [copied, setCopied] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Local mirror so each input is responsive while saveDraft persists in the background.
  const [draft, setDraft] = useState<Partial<AthleteProfileRecord>>({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (profile) setDraft(profile)
  }, [profile])

  if (loading || !profile) {
    return <div className="kr-page font-mono text-[10.5px] tracking-[0.22em] uppercase text-gold animate-pulse">Loading…</div>
  }

  const publicUrl = profile.slug ? `${window.location.origin}/players/${profile.slug}` : null

  function flash() {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  function update<K extends keyof AthleteProfileRecord>(key: K, value: AthleteProfileRecord[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function persist(patch: Partial<AthleteProfileRecord>) {
    const next = { ...draft, ...patch }
    await saveDraft({ ...patch, profile_strength_score: computeStrength(next) })
    flash()
  }

  function toggleArray(key: 'desired_division_levels' | 'regions_of_interest', value: string) {
    const current = (draft[key] as string[] | undefined) ?? []
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    update(key, next as AthleteProfileRecord[typeof key])
    persist({ [key]: next } as Partial<AthleteProfileRecord>)
  }

  async function setVisibility(v: ProfileVisibility) {
    update('profile_visibility', v)
    await saveDraft({ profile_visibility: v })
    flash()
  }

  async function copyLink() {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveAll() {
    setSaving(true)
    try {
      await saveDraft({ ...draft, profile_strength_score: computeStrength(draft) })
      flash()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="kr-page max-w-4xl">
      <PageHeader
        eyebrow="Athlete profile"
        title={<>Your <span className="kr-accent">profile</span>.</>}
        lede="Edit any field below — changes save as you type."
      />

      {/* Strength */}
      <div className="kr-panel kr-panel-warm mb-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <span className="kr-eyebrow">Profile strength</span>
            <div className="flex items-baseline gap-3 mt-3">
              <span className="font-serif text-[44px] leading-none text-gold tabular-nums" style={{ fontVariationSettings: '"opsz" 144' }}>
                {profile.profile_strength_score}
              </span>
              <span className="text-sm text-ink-2">/ 100</span>
              {profile.profile_completed && <Badge variant="green">Complete</Badge>}
              {savedFlash && <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-pitch-light">Saved</span>}
            </div>
          </div>
        </div>
        <div className="h-[3px] bg-[rgba(245,241,232,0.06)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[linear-gradient(90deg,var(--gold-3),var(--gold))] transition-[width] duration-500 ease-out"
            style={{ width: `${profile.profile_strength_score}%` }}
          />
        </div>
      </div>

      {/* Sharing */}
      <Section title="Share your profile">
        {publicUrl ? (
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 mb-5">
            <input
              readOnly
              value={publicUrl}
              className="flex-1 bg-[rgba(245,241,232,0.03)] border border-[rgba(245,241,232,0.10)] rounded-xl px-4 py-3 text-[14px] font-mono text-ink-0 tracking-tight"
            />
            <Button onClick={copyLink}>{copied ? 'Copied' : 'Copy link'}</Button>
          </div>
        ) : (
          <p className="text-sm text-ink-2 mb-5">Your shareable link appears once your profile is complete.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVisibility(opt.value)}
              className={`text-left p-4 rounded-xl border transition-[border-color,background,color,box-shadow] duration-150 ${
                draft.profile_visibility === opt.value
                  ? 'bg-[rgba(240,182,90,0.08)] border-[rgba(240,182,90,0.55)] text-ink-0 shadow-[0_0_0_3px_rgba(240,182,90,0.10)]'
                  : 'bg-[rgba(245,241,232,0.02)] border-[rgba(245,241,232,0.10)] text-ink-2 hover:border-[rgba(240,182,90,0.40)] hover:text-ink-0'
              }`}
            >
              <div className="text-[14px] font-medium mb-1.5 text-ink-0">{opt.label}</div>
              <div className="text-[12px] text-ink-2 leading-[1.5]">{opt.hint}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Basics */}
      <Section title="Basics">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full name">
            <TextInput
              value={draft.full_name ?? ''}
              onChange={(v) => update('full_name', v)}
              onBlur={() => persist({ full_name: draft.full_name ?? null })}
              placeholder="Alex Morgan"
            />
          </Field>
          <Field label="High school">
            <TextInput
              value={draft.high_school_name ?? ''}
              onChange={(v) => update('high_school_name', v)}
              onBlur={() => persist({ high_school_name: draft.high_school_name ?? null })}
              placeholder="Lincoln High School"
            />
          </Field>
        </div>

        <Field label="Class (graduation year)">
          <ChipRow cols={5}>
            {buildGradYearOptions().map(({ year, label }) => (
              <Chip
                key={year}
                active={draft.graduation_year === year}
                onClick={() => { update('graduation_year', year); persist({ graduation_year: year }) }}
              >
                <span className="font-bold text-xs">{label}</span>
                <span className="block text-[10px] text-[#9a9385] mt-0.5">Class of {year}</span>
              </Chip>
            ))}
          </ChipRow>
        </Field>
      </Section>

      {/* Soccer */}
      <Section title="Soccer">
        <Field label="Soccer program">
          <ChipRow cols={2}>
            <Chip
              active={draft.gender === 'mens'}
              onClick={() => { update('gender', 'mens'); persist({ gender: 'mens' }) }}
            >
              <span className="font-bold text-xs">Men's</span>
              <span className="block text-[10px] text-[#9a9385] mt-0.5">I'd play men's college soccer</span>
            </Chip>
            <Chip
              active={draft.gender === 'womens'}
              onClick={() => { update('gender', 'womens'); persist({ gender: 'womens' }) }}
            >
              <span className="font-bold text-xs">Women's</span>
              <span className="block text-[10px] text-[#9a9385] mt-0.5">I'd play women's college soccer</span>
            </Chip>
          </ChipRow>
        </Field>

        <Field label="Position on the field">
          <PitchPositionPicker
            primary={draft.primary_position ?? null}
            secondary={draft.secondary_position ?? null}
            onPickPrimary={(code) => {
              update('primary_position', code)
              // If the new primary equals the current secondary, clear secondary too.
              const patch: Partial<AthleteProfileRecord> = { primary_position: code }
              if (draft.secondary_position === code) {
                update('secondary_position', null)
                patch.secondary_position = null
              }
              persist(patch)
            }}
            onPickSecondary={(code) => {
              update('secondary_position', code)
              persist({ secondary_position: code })
            }}
          />
        </Field>

        <Field label="Preferred foot">
          <ChipRow cols={3}>
            {FOOT_OPTIONS.map((f) => (
              <Chip
                key={f.value}
                active={draft.preferred_foot === f.value}
                onClick={() => { update('preferred_foot', f.value); persist({ preferred_foot: f.value }) }}
              >
                {f.label}
              </Chip>
            ))}
          </ChipRow>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Club team">
            <TextInput
              value={draft.current_club ?? ''}
              onChange={(v) => update('current_club', v)}
              onBlur={() => persist({ current_club: draft.current_club ?? null })}
              placeholder="Bay Area Surf"
            />
          </Field>
          <Field label="League / division">
            <TextInput
              value={draft.current_league_or_division ?? ''}
              onChange={(v) => update('current_league_or_division', v)}
              onBlur={() => persist({ current_league_or_division: draft.current_league_or_division ?? null })}
              placeholder="ECNL, MLS Next, NPL..."
            />
          </Field>
        </div>
      </Section>

      {/* Academics */}
      <Section title="Academics">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="GPA (unweighted)">
            <TextInput
              type="number"
              step="0.01"
              value={draft.gpa?.toString() ?? ''}
              onChange={(v) => update('gpa', v ? Number(v) : null)}
              onBlur={() => persist({ gpa: draft.gpa ?? null })}
              placeholder="3.75"
            />
          </Field>
          <Field label="SAT (optional)">
            <TextInput
              type="number"
              value={draft.sat_score ?? ''}
              onChange={(v) => update('sat_score', v || null)}
              onBlur={() => persist({ sat_score: draft.sat_score ?? null })}
              placeholder="1280"
            />
          </Field>
          <Field label="ACT (optional)">
            <TextInput
              type="number"
              value={draft.act_score ?? ''}
              onChange={(v) => update('act_score', v || null)}
              onBlur={() => persist({ act_score: draft.act_score ?? null })}
              placeholder="28"
            />
          </Field>
        </div>
        <Field label="NCAA Eligibility ID (optional)">
          <TextInput
            value={draft.ncaa_eligibility_id ?? ''}
            onChange={(v) => update('ncaa_eligibility_id', v || null)}
            onBlur={() => persist({ ncaa_eligibility_id: draft.ncaa_eligibility_id ?? null })}
            placeholder="If you've registered with the NCAA Eligibility Center"
          />
        </Field>
      </Section>

      {/* College goals */}
      <Section title="College goals">
        <Field label="Target divisions">
          <ChipRow cols={5}>
            {Object.entries(DIVISION_TARGET_LABELS).map(([code, label]) => (
              <Chip
                key={code}
                active={(draft.desired_division_levels ?? []).includes(code)}
                onClick={() => toggleArray('desired_division_levels', code)}
              >
                <span className="font-bold text-xs">{code}</span>
                <span className="block text-[10px] text-[#9a9385] mt-0.5">{label}</span>
              </Chip>
            ))}
          </ChipRow>
        </Field>

        <Field label="Regions of interest">
          <ChipRow cols={4}>
            {REGIONS.map((r) => (
              <Chip
                key={r}
                active={(draft.regions_of_interest ?? []).includes(r)}
                onClick={() => toggleArray('regions_of_interest', r)}
              >
                {r}
              </Chip>
            ))}
          </ChipRow>
        </Field>

        <Field label="Academic floor">
          <p className="text-[11px] text-ink-3 leading-[1.5] -mt-1">
            Drop schools below this caliber from your matches. Composite of admission rate, SAT range, and graduation rate.
          </p>
          <ChipRow cols={1}>
            {ACADEMIC_TIER_OPTIONS.map((opt) => (
              <Chip
                key={opt.value ?? 'any'}
                active={(draft.academic_minimum ?? null) === opt.value}
                onClick={() => {
                  update('academic_minimum', opt.value)
                  persist({ academic_minimum: opt.value })
                }}
              >
                <span className="font-bold text-xs">{opt.label}</span>
                <span className="block text-[10px] text-[#9a9385] mt-0.5">{opt.detail}</span>
              </Chip>
            ))}
          </ChipRow>
        </Field>
      </Section>

      {/* Highlight video */}
      <Section title="Highlight video">
        <Field label="URL">
          <TextInput
            value={draft.highlight_video_url ?? ''}
            onChange={(v) => update('highlight_video_url', v || null)}
            onBlur={() => persist({ highlight_video_url: draft.highlight_video_url ?? null })}
            placeholder="https://youtube.com/watch?v=..."
          />
        </Field>
      </Section>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-6 md:-mx-14 px-6 md:px-14 py-4 bg-[rgba(19,16,23,0.92)] backdrop-blur-md border-t border-[rgba(245,241,232,0.08)] flex items-center justify-between gap-3 mt-12">
        <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase">
          {savedFlash
            ? <span className="text-pitch-light">All changes saved</span>
            : <span className="text-ink-3">Changes save automatically</span>}
        </span>
        <Button onClick={saveAll} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-5 pb-3 border-b border-[rgba(245,241,232,0.08)] flex items-center gap-3">
        <span className="w-1 h-4 rounded-full bg-gold" />
        <h2 className="font-mono text-[11px] font-medium tracking-[0.22em] uppercase text-ink-1">
          {title}
        </h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2">{label}</label>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  step,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  type?: string
  step?: string
}) {
  return (
    <input
      type={type}
      step={step}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className="w-full bg-[rgba(245,241,232,0.03)] border border-[rgba(245,241,232,0.10)] rounded-xl px-4 py-3 text-[15px] text-ink-0 placeholder-ink-3 caret-gold focus:outline-none focus:border-[rgba(240,182,90,0.55)] focus:ring-[3px] focus:ring-[rgba(240,182,90,0.18)] focus:bg-[rgba(245,241,232,0.05)] transition-[border-color,background,box-shadow]"
    />
  )
}

function ChipRow({ children, cols }: { children: React.ReactNode; cols?: number }) {
  const colClass = cols === 3
    ? 'grid-cols-3'
    : cols === 4
      ? 'grid-cols-2 sm:grid-cols-4'
      : cols === 5
        ? 'grid-cols-2 sm:grid-cols-5'
        : 'grid-cols-3 sm:grid-cols-5'
  return <div className={`grid ${colClass} gap-2`}>{children}</div>
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
      className={`px-3 py-2.5 rounded-xl border text-sm text-center transition-[border-color,background,color,box-shadow] duration-150 ${
        active
          ? 'bg-[rgba(240,182,90,0.10)] border-[rgba(240,182,90,0.55)] text-ink-0 shadow-[0_0_0_3px_rgba(240,182,90,0.10)]'
          : 'bg-[rgba(245,241,232,0.02)] border-[rgba(245,241,232,0.10)] text-ink-1 hover:border-[rgba(240,182,90,0.40)] hover:text-ink-0'
      }`}
    >
      {children}
    </button>
  )
}
