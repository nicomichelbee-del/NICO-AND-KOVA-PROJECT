import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    // If Supabase returned an error in the URL, show it immediately
    const params = new URLSearchParams(window.location.search)
    const urlError = params.get('error_description') || params.get('error')
    if (urlError) {
      setError(decodeURIComponent(urlError.replace(/\+/g, ' ')))
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Send everyone through onboarding — OnboardingProfile redirects
        // returning users with a completed profile straight to the dashboard.
        navigate('/onboarding/profile', { replace: true })
      } else if (event === 'SIGNED_OUT') {
        setError('Sign-in failed. Please try again.')
      }
    })

    const timeout = setTimeout(() => {
      setError('Sign-in timed out. Please try again.')
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  if (error) {
    return (
      <div className="kr-auth-shell flex flex-col items-center justify-center gap-5 px-4">
        <span className="kr-eyebrow">Sign-in error</span>
        <div className="text-crimson-light text-sm max-w-md text-center px-4 py-3 rounded-lg bg-[rgba(227,90,90,0.08)] border border-[rgba(227,90,90,0.28)]">
          {error}
        </div>
        <button
          onClick={() => navigate('/login')}
          className="font-mono text-[11px] tracking-[0.18em] uppercase text-gold hover:underline underline-offset-4"
        >
          Back to login
        </button>
      </div>
    )
  }

  return (
    <div className="kr-auth-shell flex items-center justify-center">
      <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-gold animate-pulse">
        Signing you in…
      </div>
    </div>
  )
}
