import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { KickrIQLogo } from '../components/ui/KickrIQLogo'

// Captures birth year + parental info for users who signed in before we
// required this (existing accounts) or via Google OAuth (where the signup
// form doesn't run). Hits supabase.auth.updateUser to persist into
// user_metadata.birth_year / parent_email / parent_consent_at.

const CURRENT_YEAR = new Date().getFullYear()
const MIN_BIRTH_YEAR = CURRENT_YEAR - 80
const MAX_BIRTH_YEAR = CURRENT_YEAR

function computeAge(birthYear: number): number {
  return CURRENT_YEAR - birthYear
}

export function AgeVerify() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [birthYear, setBirthYear] = useState<number | ''>('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentConsent, setParentConsent] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const ageApprox =
    typeof birthYear === 'number' && birthYear >= MIN_BIRTH_YEAR && birthYear <= MAX_BIRTH_YEAR
      ? computeAge(birthYear)
      : null
  const tooYoung = ageApprox !== null && ageApprox < 13
  const isMinor = ageApprox !== null && ageApprox >= 13 && ageApprox < 18

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (tooYoung) {
      setError('You must be 13 or older to use KickrIQ. We will sign you out.')
      await signOut()
      navigate('/', { replace: true })
      return
    }
    if (typeof birthYear !== 'number' || ageApprox === null) {
      setError('Please enter your year of birth.')
      return
    }
    if (isMinor) {
      if (!parentEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) {
        setError('Please enter a parent or guardian email.')
        return
      }
      if (!parentConsent) {
        setError('Please confirm a parent or guardian has approved your account.')
        return
      }
    }

    setSaving(true)
    const metadata: Record<string, unknown> = {
      birth_year: birthYear,
      age_verified_at: new Date().toISOString(),
    }
    if (isMinor) {
      metadata.parent_email = parentEmail.trim().toLowerCase()
      metadata.parent_consent_at = new Date().toISOString()
    }
    const { error: updateError } = await supabase.auth.updateUser({ data: metadata })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }
    navigate('/onboarding/profile', { replace: true })
  }

  return (
    <div className="kr-auth-shell flex items-center justify-center px-4 py-16">
      <div className="relative w-full max-w-[440px]" data-reveal-on-load>
        <Link to="/" className="flex flex-col items-center gap-3 mb-10 no-underline">
          <KickrIQLogo height={32} />
          <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-2">
            One last step
          </span>
        </Link>

        <div className="kr-panel kr-panel-warm">
          <div className="mb-7">
            <span className="kr-eyebrow mb-3">Account verification</span>
            <h1 className="kr-h1 mt-3">
              Confirm your <span className="kr-accent">age</span>.
            </h1>
            <p className="text-[15px] text-ink-1 mt-3 leading-[1.6]">
              KickrIQ is for athletes 13 and older. If you're under 18, we'll
              also ask for a parent or guardian's email.
            </p>
            {user?.email && (
              <p className="text-xs text-ink-3 mt-3">
                Signed in as {user.email}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-[rgba(227,90,90,0.08)] border border-[rgba(227,90,90,0.28)] text-sm text-crimson-light">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Year of birth"
              type="number"
              inputMode="numeric"
              placeholder={String(CURRENT_YEAR - 16)}
              min={MIN_BIRTH_YEAR}
              max={MAX_BIRTH_YEAR}
              value={birthYear === '' ? '' : birthYear}
              onChange={(e) => setBirthYear(e.target.value === '' ? '' : Number(e.target.value))}
              required
            />

            {tooYoung && (
              <div className="p-3 rounded-lg bg-[rgba(227,90,90,0.08)] border border-[rgba(227,90,90,0.28)] text-sm text-crimson-light">
                You must be 13 or older to use KickrIQ.
              </div>
            )}

            {isMinor && (
              <>
                <div className="p-3 rounded-lg bg-[rgba(240,182,90,0.06)] border border-[rgba(240,182,90,0.22)] text-xs text-ink-1 leading-[1.6]">
                  You're under 18. Please add a parent or guardian email so they can be looped in on what KickrIQ collects and sends on your behalf.
                </div>
                <Input
                  label="Parent or guardian email"
                  type="email"
                  placeholder="parent@example.com"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  required
                />
                <label className="flex items-start gap-2 text-xs text-ink-2 leading-[1.6] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={parentConsent}
                    onChange={(e) => setParentConsent(e.target.checked)}
                    className="mt-[3px] accent-gold"
                    required
                  />
                  <span>
                    A parent or guardian has approved my using KickrIQ and reviewed our{' '}
                    <Link to="/privacy" className="text-gold hover:underline underline-offset-4">Privacy Policy</Link>.
                  </span>
                </label>
              </>
            )}

            <Button type="submit" disabled={saving || tooYoung} className="w-full mt-2">
              {saving ? 'Saving…' : 'Continue to onboarding'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
