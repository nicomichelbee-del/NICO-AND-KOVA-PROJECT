import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { KickrIQLogo } from '../ui/KickrIQLogo'

type IconName =
  | 'overview' | 'profile' | 'timeline' | 'schools' | 'emails'
  | 'tracker' | 'followup' | 'video' | 'camps' | 'roster' | 'logout'
  | 'eligibility'

function NavIcon({ name }: { name: IconName }) {
  const props = {
    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'overview': return <svg {...props}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>
    case 'profile':  return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
    case 'timeline': return <svg {...props}><path d="M5 12h14"/><circle cx="6" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>
    case 'schools':  return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>
    case 'emails':   return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>
    case 'tracker':  return <svg {...props}><path d="M3 17l5-5 4 4 8-9"/><path d="M14 7h6v6"/></svg>
    case 'followup': return <svg {...props}><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>
    case 'video':    return <svg {...props}><rect x="3" y="6" width="14" height="12" rx="2"/><path d="M17 10l4-2v8l-4-2z"/></svg>
    case 'camps':    return <svg {...props}><path d="M3 21l9-15 9 15z"/><path d="M3 21h18"/></svg>
    case 'roster':   return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14h3"/><path d="M8 17h6"/><circle cx="17" cy="15" r="2" fill="currentColor" stroke="none"/></svg>
    case 'logout':   return <svg {...props}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>
    case 'eligibility': return <svg {...props}><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>
  }
}

type NavGroup = {
  label: string
  items: Array<{ to: string; label: string; icon: IconName; end: boolean; tier?: 'PRO' | null }>
}

const navGroups: NavGroup[] = [
  {
    label: 'Recruiting',
    items: [
      { to: '/dashboard',             label: 'Overview',            icon: 'overview',    end: true },
      { to: '/dashboard/profile',     label: 'My Profile',          icon: 'profile',     end: false },
      { to: '/dashboard/timeline',    label: 'Timeline',            icon: 'timeline',    end: false },
      { to: '/dashboard/eligibility', label: 'Eligibility & Docs',  icon: 'eligibility', end: false },
    ],
  },
  {
    label: 'Outreach',
    items: [
      { to: '/dashboard/schools',  label: 'School Matches',      icon: 'schools',  end: false },
      { to: '/dashboard/emails',   label: 'Coach Emails',        icon: 'emails',   end: false },
      { to: '/dashboard/tracker',  label: 'Outreach Tracker',    icon: 'tracker',  end: false, tier: 'PRO' },
      { to: '/dashboard/followup', label: 'Follow-up Assistant', icon: 'followup', end: false, tier: 'PRO' },
    ],
  },
  {
    label: 'Discover',
    items: [
      { to: '/dashboard/video',    label: 'Video Rater',         icon: 'video',    end: false, tier: 'PRO' },
      { to: '/dashboard/camps',    label: 'ID Camps',            icon: 'camps',    end: false },
      { to: '/dashboard/roster',   label: 'Roster Intel',        icon: 'roster',   end: false },
    ],
  },
]

export function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <aside className="kr-sidebar fixed left-0 top-0 bottom-0 w-64 z-40 flex flex-col">
      {/* Brand */}
      <div className="px-6 py-7 border-b border-[rgba(245,241,232,0.06)]">
        <NavLink to="/" className="inline-flex items-center no-underline">
          <KickrIQLogo height={28} />
        </NavLink>
        <div className="mt-2 font-mono text-[9.5px] tracking-[0.22em] uppercase text-ink-3">
          Recruiting · Counselor
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-4 overflow-y-auto scrollbar-hide">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <div className="px-3 mb-1 font-mono text-[9.5px] tracking-[0.22em] uppercase text-ink-3">
              {group.label}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg text-[13.5px] font-medium tracking-[-0.005em] transition-[color,background] duration-150 no-underline ${
                    isActive
                      ? 'text-gold kr-sidebar-link-active'
                      : 'text-ink-1 hover:text-ink-0 hover:bg-[rgba(245,241,232,0.04)]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`w-5 h-5 inline-flex items-center justify-center ${isActive ? 'text-gold' : 'text-ink-2 group-hover:text-ink-1'}`}>
                      <NavIcon name={item.icon} />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.tier === 'PRO' && (
                      <span className="font-mono text-[8.5px] tracking-[0.18em] text-gold/70 px-1.5 py-0.5 rounded border border-[rgba(240,182,90,0.18)]">PRO</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User block */}
      <div className="px-3 py-4 border-t border-[rgba(245,241,232,0.06)]">
        <div className="px-3 py-3 mb-2 rounded-xl bg-[rgba(240,182,90,0.04)] border border-[rgba(240,182,90,0.14)]">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-ink-3">
              Free plan
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.16em] uppercase text-gold">
              <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />
              Active
            </span>
          </div>
          <div className="text-[13px] text-ink-0 truncate mt-1.5">
            {user?.email ?? '—'}
          </div>
          <button
            onClick={() => navigate('/signup')}
            className="mt-2.5 w-full text-[11.5px] font-medium tracking-[-0.005em] text-[#1a1304] bg-[linear-gradient(180deg,#f5c170_0%,#e0982e_100%)] rounded-md py-1.5 transition-shadow hover:shadow-[0_0_0_4px_rgba(240,182,90,0.18)]"
          >
            Upgrade to Pro
          </button>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-ink-2 hover:text-ink-0 hover:bg-[rgba(245,241,232,0.04)] transition-colors text-left"
        >
          <span className="w-5 h-5 inline-flex items-center justify-center">
            <NavIcon name="logout" />
          </span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
