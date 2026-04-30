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
        navigate('/dashboard', { replace: true })
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
      <div className="min-h-screen bg-[#07090f] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-sm">{error}</div>
        <button
          onClick={() => navigate('/login')}
          className="text-[#eab308] text-sm underline"
        >
          Back to login
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center">
      <div className="text-[#eab308] text-sm font-medium">Signing you in...</div>
    </div>
  )
}
