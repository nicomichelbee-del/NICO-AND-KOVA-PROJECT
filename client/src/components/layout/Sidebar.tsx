import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { BeekoLogo } from '../ui/BeekoLogo'

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: '⊞', end: true },
  { to: '/dashboard/profile', label: 'My Profile', icon: '👤', end: false },
  { to: '/dashboard/timeline', label: 'Timeline', icon: '📍', end: false },
  { to: '/dashboard/schools', label: 'School Matches', icon: '🎯', end: false },
  { to: '/dashboard/emails', label: 'Coach Emails', icon: '✉️', end: false },
  { to: '/dashboard/tracker', label: 'Outreach Tracker', icon: '📊', end: false },
  { to: '/dashboard/followup', label: 'Follow-up Assistant', icon: '💬', end: false },
  { to: '/dashboard/video', label: 'Video Rater', icon: '🎬', end: false },
  { to: '/dashboard/camps', label: 'ID Camps', icon: '⛺', end: false },
  { to: '/dashboard/roster', label: 'Roster Intel', icon: '🔍', end: false },
  { to: '/dashboard/chat', label: 'Ask Beeko', icon: '🤖', end: false },
]

export function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    localStorage.removeItem('testMode')
    await signOut()
    navigate('/')
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-[#0c1118] border-r border-[rgba(255,255,255,0.07)] flex flex-col z-40">
      <div className="px-6 py-6 border-b border-[rgba(255,255,255,0.07)]">
        <BeekoLogo size={34} textClassName="font-serif text-lg font-black text-[#f1f5f9]" />
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline ${
                isActive
                  ? 'bg-[rgba(234,179,8,0.1)] text-[#eab308] border border-[rgba(234,179,8,0.2)]'
                  : 'text-[#64748b] hover:text-[#f1f5f9] hover:bg-[rgba(255,255,255,0.04)]'
              }`
            }
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-[rgba(255,255,255,0.07)]">
        <div className="px-3 py-2 mb-1">
          {localStorage.getItem('testMode') === 'true' ? (
            <>
              <div className="text-xs font-medium text-[#eab308] truncate">Test Mode</div>
              <div className="text-xs text-[#64748b] mt-0.5">Not signed in</div>
            </>
          ) : (
            <>
              <div className="text-xs font-medium text-[#f1f5f9] truncate">{user?.email}</div>
              <div className="text-xs text-[#64748b] mt-0.5">Free plan</div>
            </>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#64748b] hover:text-[#f1f5f9] hover:bg-[rgba(255,255,255,0.04)] transition-colors text-left"
        >
          <span className="text-base w-5 text-center">→</span>
          {localStorage.getItem('testMode') === 'true' ? 'Exit test mode' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
