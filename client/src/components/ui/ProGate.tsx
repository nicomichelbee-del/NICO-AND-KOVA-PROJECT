import { useEffect, useState } from 'react'
import { Card } from './Card'
import { Button } from './Button'
import { WaitlistModal } from './WaitlistModal'
import { previewRemaining, getPreviewUses, FREE_PREVIEW_LIMIT, hasJoinedWaitlist, type ProFeature, PRO_FEATURE_LABEL } from '../../lib/waitlist'
import { useAuth, TEST_MODE_KEY } from '../../context/AuthContext'

// Test mode = full Pro access. Lives outside the component so it's evaluated
// once per render, not as React state.
function isTestModeActive() {
  return import.meta.env.DEV && typeof localStorage !== 'undefined' && localStorage.getItem(TEST_MODE_KEY) === 'true'
}

interface ProGateProps {
  feature: ProFeature
  children: React.ReactNode
}

// Wraps a Pro page. While billing is on hold:
//  - Shows a small banner above the feature noting "Pro preview · N uses left"
//    while the user has remaining preview uses.
//  - Once preview is exhausted, replaces the page with a waitlist card.
//
// The page itself is responsible for calling consumePreview(feature) when the
// user actually triggers the AI/Gmail-backed action — not on mount.
export function ProGate({ feature, children }: ProGateProps) {
  const { user } = useAuth()
  const [remaining, setRemaining] = useState(() => previewRemaining(feature))
  const [showModal, setShowModal] = useState(false)

  // Dev/test mode bypasses every Pro gate — nothing about counters, waitlists,
  // or banners. Renders the underlying feature exactly as a paid Pro user
  // would see it. Production builds tree-shake this branch (DEV is false).
  if (isTestModeActive()) return <>{children}</>

  // Re-check when localStorage changes (e.g. after consumePreview is called)
  useEffect(() => {
    function refresh() { setRemaining(previewRemaining(feature)) }
    window.addEventListener('storage', refresh)
    window.addEventListener('kickriq:preview-changed', refresh as EventListener)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('kickriq:preview-changed', refresh as EventListener)
    }
  }, [feature])

  const exhausted = remaining <= 0
  const used = getPreviewUses(feature)
  const joined = hasJoinedWaitlist(user?.email)

  if (exhausted) {
    return (
      <div className="kr-page max-w-3xl">
        <Card featured className="p-10 text-center">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-gold">
            Pro · Coming soon
          </span>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#f5f1e8] leading-tight mt-3 mb-3">
            {PRO_FEATURE_LABEL[feature]} is a Pro feature.
          </h1>
          <p className="text-sm text-ink-2 max-w-md mx-auto leading-relaxed">
            {joined
              ? "You're on the waitlist — we'll email you the moment Pro opens up. Until then, the rest of the app is fully free."
              : "You've used your free preview. Pro is launching soon. Join the waitlist and we'll let you know the moment it's live."}
          </p>

          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            {joined ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.05)] text-[#4ade80] font-mono text-[11px] tracking-[0.18em] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] shadow-[0_0_8px_#4ade80]" />
                On the waitlist
              </span>
            ) : (
              <Button onClick={() => setShowModal(true)}>Join the Pro waitlist</Button>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-[rgba(245,241,232,0.06)] grid grid-cols-3 gap-4 text-left max-w-lg mx-auto">
            {OTHER_PRO_FEATURES.filter(f => f.id !== feature).slice(0, 3).map((f) => (
              <div key={f.id}>
                <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-ink-3 mb-1">Also Pro</div>
                <div className="text-[13px] text-ink-1">{f.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <WaitlistModal
          open={showModal}
          onClose={() => setShowModal(false)}
          feature={feature}
          tier="pro"
        />
      </div>
    )
  }

  return (
    <>
      <PreviewBanner feature={feature} remaining={remaining} used={used} onUpgrade={() => setShowModal(true)} />
      {children}
      <WaitlistModal
        open={showModal}
        onClose={() => setShowModal(false)}
        feature={feature}
        tier="pro"
      />
    </>
  )
}

function PreviewBanner({
  feature,
  remaining,
  used,
  onUpgrade,
}: {
  feature: ProFeature
  remaining: number
  used: number
  onUpgrade: () => void
}) {
  return (
    <div className="kr-page max-w-4xl mb-3">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-[rgba(240,182,90,0.18)] bg-[rgba(240,182,90,0.04)]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-gold flex-shrink-0">
            Pro preview
          </span>
          <span className="text-[12.5px] text-ink-1 truncate">
            {used === 0
              ? `You have ${remaining} free try of ${PRO_FEATURE_LABEL[feature]}.`
              : `${remaining} preview ${remaining === 1 ? 'use' : 'uses'} left of ${FREE_PREVIEW_LIMIT}.`}
          </span>
        </div>
        <button
          onClick={onUpgrade}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-gold hover:text-[#f5c170] flex-shrink-0"
        >
          Join waitlist →
        </button>
      </div>
    </div>
  )
}

const OTHER_PRO_FEATURES: { id: ProFeature; label: string }[] = [
  { id: 'tracker', label: 'Outreach Tracker + Gmail sync' },
  { id: 'followup', label: 'Follow-up Assistant' },
  { id: 'video', label: 'AI Highlight Video Rater' },
]
