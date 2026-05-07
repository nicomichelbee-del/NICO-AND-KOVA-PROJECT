import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { KickrIQLogo } from '../components/ui/KickrIQLogo'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export function ForCoaches() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Already signed in? Send straight to the coach dashboard.
  useEffect(() => {
    if (user) navigate('/for-coaches/dashboard', { replace: true })
  }, [user, navigate])

  async function sendMagicLink() {
    if (!email.trim()) return
    setSending(true); setError('')
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/for-coaches/dashboard` },
      })
      if (err) throw err
      setSentTo(email.trim())
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Could not send link'
      // Translate common Supabase auth errors into coach-readable copy.
      const friendly = /invalid/i.test(raw)
        ? "That email address doesn't look right. Use your school's official .edu coach email."
        : /rate.?limit/i.test(raw)
        ? 'Too many requests. Wait a minute and try again.'
        : raw
      setError(friendly)
    } finally { setSending(false) }
  }

  return (
    <div className="kickriq min-h-screen">
      <div className="page">
        <header className="knav knav-scrolled">
          <div className="wrap knav-inner">
            <Link to="/" className="brand"><KickrIQLogo height={28} /></Link>
            <nav className="knav-links hide-mobile">
              <Link to="/">For Athletes</Link>
              <Link to="/open-spots">Open Spots</Link>
            </nav>
          </div>
        </header>

        <section className="section" style={{ paddingTop: 140 }}>
          <div className="wrap" style={{ maxWidth: 880 }}>
            <div className="text-center">
              <span className="section-marker" style={{ justifyContent: 'center' }}>For College Coaches</span>
              <h1 className="h-display" style={{ marginTop: 16 }}>
                Claim your program. <span className="accent">Free, forever.</span>
              </h1>
              <p className="lede" style={{ marginTop: 16, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
                See which athletes have emailed you through KickrIQ, edit your roster needs, and stop getting flooded by recruits at positions you've already filled.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-12">
              {[
                { t: 'See real interest', b: 'A live feed of athletes who have actively reached out about your program.' },
                { t: 'Edit your needs', b: "Tell the platform exactly which positions you're recruiting — no more emails about openings you don't have." },
                { t: 'Always free', b: 'No paid coach tier. We make money from athletes, not from you.' },
              ].map((f) => (
                <Card key={f.t} className="p-5">
                  <div className="font-serif text-base font-bold text-[#f5f1e8]">{f.t}</div>
                  <p className="text-xs text-[#9a9385] mt-2 leading-relaxed">{f.b}</p>
                </Card>
              ))}
            </div>

            <Card className="p-8 mt-10 max-w-lg mx-auto">
              {sentTo ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-[rgba(240,182,90,0.12)] flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f0b65a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <polyline points="3 7 12 13 21 7" />
                    </svg>
                  </div>
                  <div className="font-serif text-lg font-bold text-[#f5f1e8] mb-2">Check your inbox</div>
                  <p className="text-sm text-[#9a9385]">
                    We sent a magic sign-in link to <span className="text-[#f0b65a]">{sentTo}</span>.
                    Click it to land on your coach dashboard.
                  </p>
                  <button
                    onClick={() => { setSentTo(null); setEmail('') }}
                    className="text-[11px] font-mono uppercase tracking-wider text-[#9a9385] hover:text-[#f0b65a] mt-4"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMagicLink() }}
                >
                  <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#f0b65a] mb-3 text-center">
                    Sign in with your coach email
                  </div>
                  <p className="text-xs text-[#9a9385] mb-4 text-center">
                    We verify your email matches the program's listed coach contact in our database (so only the real coach can claim).
                  </p>
                  <Input
                    label="Your .edu coach email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="coach@university.edu"
                    autoFocus
                    autoComplete="email"
                    disabled={sending}
                  />
                  {error && (
                    <div className="mt-3 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={sending || !email.trim() || !email.includes('@')}
                    className="w-full mt-4"
                  >
                    {sending ? 'Sending…' : 'Send magic link'}
                  </Button>
                  <p className="text-[10px] text-[#9a9385] mt-3 text-center">
                    No password — we'll email you a one-click sign-in link.
                  </p>
                </form>
              )}
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}
