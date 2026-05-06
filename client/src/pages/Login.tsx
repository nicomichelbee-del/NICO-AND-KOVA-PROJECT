import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, TEST_MODE_KEY } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { KickrIQLogo } from '../components/ui/KickrIQLogo'

export function Login() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  // Wait for AuthContext to register the new session before navigating, or
  // ProtectedRoute will bounce us back to /login on the first render.
  useEffect(() => {
    if (signedIn && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [signedIn, user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setSignedIn(true)
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
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
      <div className="relative w-full max-w-[420px]" data-reveal-on-load>
        {/* Brand + tagline */}
        <Link to="/" className="flex flex-col items-center gap-3 mb-10 no-underline">
          <KickrIQLogo height={32} />
          <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-2">
            Recruiting · Counselor
          </span>
        </Link>

        <div className="kr-panel">
          <div className="mb-7">
            <span className="kr-eyebrow mb-3">Welcome back</span>
            <h1 className="kr-h1 mt-3">
              Pick up where <span className="kr-accent">you left off</span>.
            </h1>
            <p className="text-[15px] text-ink-1 mt-3 leading-[1.6]">
              Sign in to keep your coach outreach moving.
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
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[rgba(245,241,232,0.08)]" />
            <span className="font-mono text-[10px] tracking-[0.20em] uppercase text-ink-3">
              Or with email
            </span>
            <div className="flex-1 h-px bg-[rgba(245,241,232,0.08)]" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-sm text-ink-2 text-center mt-6">
            New here?{' '}
            <Link to="/signup" className="text-gold hover:underline underline-offset-4">
              Create a free account
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
          Free to start · 2,500+ programs · 98.8% coverage
        </div>
      </div>
    </div>
  )
}
