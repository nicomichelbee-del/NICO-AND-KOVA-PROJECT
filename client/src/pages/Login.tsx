import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard')
  }

  function handleTestMode() {
    localStorage.setItem('testMode', 'true')
    navigate('/dashboard')
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 font-serif text-lg font-bold text-[#f1f5f9] mb-10 no-underline">
          <div className="w-8 h-8 bg-[#eab308] rounded flex items-center justify-center text-sm">⚽</div>
          SoccerRecruit
        </Link>
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(234,179,8,0.15)] rounded-2xl p-8">
          <h1 className="font-serif text-2xl font-bold text-[#f1f5f9] mb-1">Welcome back</h1>
          <p className="text-sm text-[#64748b] mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-5 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
          )}

          <button
            onClick={handleTestMode}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 mb-5 bg-[#eab308] hover:bg-[#ca9a06] text-black font-bold text-sm rounded-xl transition-all"
          >
            ⚽ Explore the Dashboard — No Account Needed
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.07)]" />
            <span className="text-xs text-[#64748b]">or sign in with email</span>
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.07)]" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <p className="text-sm text-[#64748b] text-center mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#eab308] hover:underline">Sign up free</Link>
          </p>
        </div>

      </div>
    </div>
  )
}
