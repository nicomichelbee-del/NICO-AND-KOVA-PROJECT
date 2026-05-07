import { useEffect, useState } from 'react'

interface Props { coachUserId: string }

export function GmailConnectBanner({ coachUserId }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/gmail/status?userId=${encodeURIComponent(coachUserId)}`)
      .then((r) => r.json())
      .then((d) => { setConnected(!!d.connected); setEmail(d.email ?? null) })
      .catch(() => setConnected(false))
  }, [coachUserId])

  // postMessage from the Gmail OAuth popup tells us when connection succeeds.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'gmail-connected') {
        setConnected(true)
        if (e.data.email) setEmail(e.data.email)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  if (connected === null) return null
  if (connected) {
    return (
      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#4ade80] flex items-center gap-2">
        <span>✓ Gmail connected</span>
        {email && <span className="text-[#9a9385] normal-case tracking-normal">· {email}</span>}
      </div>
    )
  }

  function connect() {
    fetch(`/api/gmail/auth?userId=${encodeURIComponent(coachUserId)}`)
      .then((r) => r.json())
      .then(({ url }) => { if (url) window.open(url, '_blank', 'width=500,height=600') })
  }

  return (
    <div className="rounded-lg border border-[rgba(240,182,90,0.35)] bg-[rgba(240,182,90,0.06)] px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#f0b65a]">Connect Gmail to reply</div>
        <div className="text-xs text-[#cfc7b2] mt-1">
          KickrIQ sends your replies through your own .edu Gmail so athletes recognize you instantly.
        </div>
      </div>
      <button
        onClick={connect}
        className="text-xs font-mono uppercase tracking-wider px-4 py-2 rounded bg-[#f0b65a] text-black font-bold hover:bg-[#e2a747] transition-colors whitespace-nowrap"
      >
        Connect Gmail →
      </button>
    </div>
  )
}
