import { useEffect, useState } from 'react'
import { Button } from './Button'
import { Input } from './Input'
import { Card } from './Card'
import { joinWaitlist, hasJoinedWaitlist, type ProFeature, PRO_FEATURE_LABEL } from '../../lib/waitlist'
import { useAuth } from '../../context/AuthContext'

interface WaitlistModalProps {
  open: boolean
  onClose: () => void
  feature?: ProFeature | 'general'
  tier?: 'pro' | 'family'
  // Optional: shown above the form. Defaults to a Pro pitch.
  headline?: string
  blurb?: string
}

export function WaitlistModal({
  open,
  onClose,
  feature = 'general',
  tier = 'pro',
  headline,
  blurb,
}: WaitlistModalProps) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setEmail(user?.email ?? '')
      setError('')
      setDone(hasJoinedWaitlist(user?.email))
    }
  }, [open, user?.email])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const featureLabel = feature !== 'general' ? PRO_FEATURE_LABEL[feature as ProFeature] : null
  const defaultHeadline = featureLabel
    ? `${featureLabel} is a ${tier === 'family' ? 'Family' : 'Pro'} feature.`
    : `${tier === 'family' ? 'Family' : 'Pro'} is launching soon.`
  const defaultBlurb = featureLabel
    ? `You've used your free preview. Pro is launching soon — join the waitlist and we'll let you know the moment it's live.`
    : `We're polishing the paid tier. Drop your email and we'll ping you the moment Pro opens up.`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setBusy(true)
    const res = await joinWaitlist({ email, feature, tier })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'Something went wrong.'); return }
    setDone(true)
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <Card featured className="p-7">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-gold">
              {tier === 'family' ? 'Family · Waitlist' : 'Pro · Waitlist'}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full text-ink-2 hover:text-ink-0 hover:bg-[rgba(245,241,232,0.06)] flex items-center justify-center text-lg"
              aria-label="Close"
            >×</button>
          </div>

          <h2 className="font-serif text-2xl font-bold text-[#f5f1e8] leading-tight mb-2">
            {headline ?? defaultHeadline}
          </h2>
          <p className="text-sm text-ink-2 mb-6 leading-relaxed">
            {blurb ?? defaultBlurb}
          </p>

          {done ? (
            <div className="rounded-xl border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.05)] p-4 mb-4">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#4ade80] mb-1">You're in</div>
              <div className="text-sm text-[#f5f1e8]">
                We'll email <span className="text-[#f0b65a]">{email}</span> the moment Pro opens up.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                autoFocus
                required
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Joining…' : 'Join the waitlist'}
              </Button>
            </form>
          )}

          <div className="mt-5 pt-5 border-t border-[rgba(245,241,232,0.06)]">
            <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-ink-3 mb-2">
              {tier === 'family' ? 'Family includes' : 'Pro includes'}
            </div>
            <ul className="text-[13px] text-ink-1 leading-6 space-y-1">
              {(tier === 'family' ? FAMILY_FEATURES : PRO_FEATURES).map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-gold/70 mt-[1px]">›</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {done && (
            <Button variant="outline" className="w-full mt-4" onClick={onClose}>
              Back to free version
            </Button>
          )}
        </Card>
      </div>
    </div>
  )
}

const PRO_FEATURES = [
  'Unlimited coach emails',
  'Outreach tracker + Gmail sync',
  'Follow-up assistant',
  'AI Highlight Video Rater',
  'Roster intelligence',
]

const FAMILY_FEATURES = [
  'Everything in Pro',
  'Parent read-only dashboard',
  'Weekly progress email to parents',
  'Shared deadlines & visit calendar',
]
