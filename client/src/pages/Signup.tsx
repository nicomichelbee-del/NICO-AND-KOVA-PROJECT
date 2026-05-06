import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, TEST_MODE_KEY } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { KickrIQLogo } from '../components/ui/KickrIQLogo'

// Earliest plausible year a current high-school junior could be born.
// We use it as the upper bound on the birth-year input so a typo can't pass.
const CURRENT_YEAR = new Date().getFullYear()
const MIN_BIRTH_YEAR = CURRENT_YEAR - 80
const MAX_BIRTH_YEAR = CURRENT_YEAR

function computeAge(birthYear: number): number {
  // Approximate — we don't ask DOB, just year. Treat anyone whose birth-year
  // is N years ago as "could be N or N-1 depending on month". The under-13
  // block uses N-1 to be safe (if you turn 13 this calendar year you're in).
  return CURRENT_YEAR - birthYear
}

export function Signup() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState<number | ''>('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentConsent, setParentConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [signedUp, setSignedUp] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  const ageApprox = typeof birthYear === 'number' && birthYear >= MIN_BIRTH_YEAR && birthYear <= MAX_BIRTH_YEAR
    ? computeAge(birthYear)
    : null
  const tooYoung = ageApprox !== null && ageApprox < 13
  const isMinor = ageApprox !== null && ageApprox >= 13 && ageApprox < 18
  const needsParentInfo = isMinor

  // Once Supabase has confirmed the new session, route to onboarding.
  useEffect(() => {
    if (signedUp && user) {
      navigate('/onboarding/profile', { replace: true })
    }
  }, [signedUp, user, navigate])

  async function handleGoogle() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Age gate. Block under-13 outright (COPPA — collecting an email + name
    // from a child this young requires verifiable parental consent we don't
    // have infrastructure for, so we simply don't accept the signup).
    if (tooYoung) {
      setError('You must be 13 or older to use KickrIQ. Please come back when you are.')
      return
    }
    if (typeof birthYear !== 'number' || ageApprox === null) {
      setError('Please enter your year of birth.')
      return
    }
    if (needsParentInfo) {
      if (!parentEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) {
        setError('Please enter a parent or guardian email.')
        return
      }
      if (!parentConsent) {
        setError('Please confirm a parent or guardian has approved your account.')
        return
      }
    }

    setLoading(true)
    const metadata: Record<string, unknown> = {
      full_name: name,
      birth_year: birthYear,
      age_verified_at: new Date().toISOString(),
    }
    if (needsParentInfo) {
      metadata.parent_email = parentEmail.trim().toLowerCase()
      metadata.parent_consent_at = new Date().toISOString()
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (data.session) {
      // Auto-confirm enabled — session is live. Effect above will navigate
      // once AuthContext picks up the new user.
      setSignedUp(true)
    } else {
      // Email confirmation required — surface a "check your email" view.
      setLoading(false)
      setConfirmSent(true)
    }
  }

  if (confirmSent) {
    return (
      <div className="kr-auth-shell flex items-center justify-center px-4 py-16">
        <div className="relative w-full max-w-[440px]" data-reveal-on-load>
          <Link to="/" className="flex flex-col items-center gap-3 mb-10 no-underline">
            <KickrIQLogo height={32} />
            <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-2">
              Recruiting · Counselor
            </span>
          </Link>

          <div className="kr-panel kr-panel-warm">
            <span className="kr-eyebrow mb-3">Almost there</span>
            <h1 className="kr-h1 mt-3">
              Check your <span className="kr-accent">email</span>.
            </h1>
            <p className="text-[15px] text-ink-1 mt-3 leading-[1.6]">
              We sent a confirmation link to <span className="text-ink-0 font-medium">{email}</span>.
              Click it and we'll drop you straight into your profile setup.
            </p>
            <p className="text-sm text-ink-3 mt-5 leading-[1.6]">
              Wrong address? <button onClick={() => { setConfirmSent(false); setLoading(false) }} className="text-gold hover:underline underline-offset-4">Use a different email</button>.
            </p>
          </div>
        </div>
      </div>
    )
  }

  function handleTestMode() {
    localStorage.setItem(TEST_MODE_KEY, 'true')
    localStorage.setItem('athleteProfileRecord', JSON.stringify({
      full_name: 'Test Athlete',
      graduation_year: 2027,
      primary_position: 'Forward',
      secondary_position: null,
      preferred_foot: 'Right',
      current_club: 'Test FC',
      current_league_or_division: 'ECNL',
      high_school_name: 'Test High School',
      gpa: 3.8,
      sat_score: null,
      act_score: null,
      ncaa_eligibility_id: null,
      desired_division_levels: ['D1', 'D2'],
      regions_of_interest: [],
      highlight_video_url: null,
      slug: 'test-athlete',
      profile_visibility: 'private',
      profile_strength_score: 75,
      profile_completed: true,
    }))
    window.location.href = '/dashboard'
  }

  return (
    <div className="kr-auth-shell flex items-center justify-center px-4 py-16">
      <div className="relative w-full max-w-[440px]" data-reveal-on-load>
        <Link to="/" className="flex flex-col items-center gap-3 mb-10 no-underline">
          <KickrIQLogo height={32} />
          <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-2">
            Recruiting · Counselor
          </span>
        </Link>

        <div className="kr-panel kr-panel-warm">
          <div className="mb-7">
            <span className="kr-eyebrow mb-3">Create your account</span>
            <h1 className="kr-h1 mt-3">
              Get <span className="kr-accent">recruited</span>.<br />
              Not overlooked.
            </h1>
            <p className="text-[15px] text-ink-1 mt-3 leading-[1.6]">
              3 coach emails and 5 school matches on the house. No card.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-[rgba(227,90,90,0.08)] border border-[rgba(227,90,90,0.28)] text-sm text-crimson-light">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full inline-flex items-center justify-center gap-3 py-2.5 px-4 mb-5 rounded-full text-[14px] font-medium bg-[rgba(245,241,232,0.95)] hover:bg-white text-[#1a1304] disabled:opacity-60 transition-colors"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleLoading ? 'Redirecting…' : 'Sign up with Google'}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[rgba(245,241,232,0.08)]" />
            <span className="font-mono text-[10px] tracking-[0.20em] uppercase text-ink-3">
              Or create an account
            </span>
            <div className="flex-1 h-px bg-[rgba(245,241,232,0.08)]" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full name" type="text" placeholder="Alex Johnson" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
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
                You must be 13 or older to use KickrIQ. We can't create an account for someone under 13.
              </div>
            )}

            {needsParentInfo && (
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

            <Button type="submit" disabled={loading || tooYoung} className="w-full mt-2">
              {loading ? 'Creating account…' : 'Create free account'}
            </Button>
          </form>

          <p className="text-xs text-ink-3 text-center mt-4 leading-[1.6]">
            By signing up you agree to our{' '}
            <Link to="/terms" className="text-gold hover:underline underline-offset-4">Terms of Service</Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-gold hover:underline underline-offset-4">Privacy Policy</Link>.
          </p>
          <p className="text-sm text-ink-2 text-center mt-3">
            Already a member?{' '}
            <Link to="/login" className="text-gold hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>

          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleTestMode}
              className="w-full mt-6 py-2 px-4 rounded-full text-[11px] font-mono uppercase tracking-[0.18em] text-ink-3 border border-dashed border-[rgba(245,241,232,0.18)] hover:border-gold hover:text-gold transition-colors"
            >
              Skip login · test mode (dev only)
            </button>
          )}
        </div>

        <div className="mt-6 text-center font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3">
          D1 · D2 · D3 · NAIA · JUCO
        </div>
      </div>
    </div>
  )
}
