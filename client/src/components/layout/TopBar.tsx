import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ROUTE_TITLE: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/profile': 'My Profile',
  '/dashboard/timeline': 'Recruitment Timeline',
  '/dashboard/schools': 'School Matches',
  '/dashboard/emails': 'Coach Emails',
  '/dashboard/tracker': 'Outreach Tracker',
  '/dashboard/followup': 'Follow-up Assistant',
  '/dashboard/video': 'Highlight Video Rater',
  '/dashboard/camps': 'ID Camps',
  '/dashboard/roster': 'Roster Intel',
}

function initialOf(name?: string | null, fallback = 'A'): string {
  if (!name) return fallback
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? fallback).toUpperCase()
}

export function TopBar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(tick)
  }, [])

  const title = ROUTE_TITLE[location.pathname] ?? 'KickrIQ'
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'Athlete'
  const initial = initialOf(user?.user_metadata?.full_name as string | undefined, (user?.email?.[0] ?? 'A').toUpperCase())
  const dateLabel = now.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim().toLowerCase()
    if (!q) return
    if (q.includes('school') || q.includes('match')) navigate('/dashboard/schools')
    else if (q.includes('email') || q.includes('coach')) navigate('/dashboard/emails')
    else if (q.includes('camp')) navigate('/dashboard/camps')
    else if (q.includes('video') || q.includes('highlight')) navigate('/dashboard/video')
    else if (q.includes('time') || q.includes('plan')) navigate('/dashboard/timeline')
    else if (q.includes('track') || q.includes('outreach')) navigate('/dashboard/tracker')
    setQuery('')
  }

  return (
    <header className="kr-topbar">
      <div className="flex items-center gap-4 min-w-0">
        <div className="hidden md:flex flex-col leading-tight min-w-0">
          <span className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-ink-3">
            {dateLabel}
          </span>
          <span className="font-serif text-[18px] text-ink-0 truncate" style={{ letterSpacing: '-0.015em' }}>
            {title}
          </span>
        </div>
      </div>

      <form className="kr-topbar-search" onSubmit={onSubmit}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to schools, emails, camps…"
        />
        <span className="kr-topbar-kbd hidden sm:inline-block">⌘K</span>
      </form>

      <div className="kr-topbar-actions">
        <button className="kr-icon-btn" aria-label="Notifications" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
          <span className="kr-icon-btn-dot" />
        </button>
        <button
          className="kr-icon-btn hidden sm:inline-flex"
          aria-label="Help"
          type="button"
          onClick={() => navigate('/dashboard/timeline')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </button>
        <button
          className="kr-avatar"
          aria-label={`Profile · ${fullName}`}
          type="button"
          onClick={() => navigate('/dashboard/profile')}
        >
          {initial}
        </button>
      </div>
    </header>
  )
}
