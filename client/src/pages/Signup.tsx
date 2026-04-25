import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 font-serif text-lg font-bold text-[#f1f5f9] mb-10 no-underline">
          <div className="w-8 h-8 bg-[#eab308] rounded flex items-center justify-center text-sm">⚽</div>
          SoccerRecruit
        </Link>
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(234,179,8,0.15)] rounded-2xl p-8">
          <h1 className="font-serif text-2xl font-bold text-[#f1f5f9] mb-1">Start for free</h1>
          <p className="text-sm text-[#64748b] mb-8">No credit card required</p>
          {error && (
            <div className="mb-5 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full name" type="text" placeholder="Alex Johnson" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Creating account...' : 'Create Free Account'}
            </Button>
          </form>
          <p className="text-xs text-[#64748b] text-center mt-4">By signing up you agree to our Terms of Service.</p>
          <p className="text-sm text-[#64748b] text-center mt-3">
            Already have an account?{' '}
            <Link to="/login" className="text-[#eab308] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
