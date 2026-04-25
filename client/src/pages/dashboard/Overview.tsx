import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'

const quickActions = [
  { to: '/dashboard/profile', icon: '👤', title: 'Complete your profile', desc: 'Add your stats, GPA, and club info', badge: 'Start here' },
  { to: '/dashboard/schools', icon: '🎯', title: 'Find your schools', desc: 'Get AI-matched reach, target & safety schools', badge: '5 free' },
  { to: '/dashboard/emails', icon: '✉️', title: 'Email a coach', desc: 'Generate your first personalized outreach', badge: '3 free' },
]

const recentActivity = [
  { icon: '✉️', text: 'Coach email generated for Wake Forest University', time: '2h ago', badgeVariant: 'muted' as const, badgeLabel: 'Draft' },
  { icon: '🎯', text: '12 school matches found based on your profile', time: '1d ago', badgeVariant: 'gold' as const, badgeLabel: 'New' },
  { icon: '👤', text: 'Athlete profile updated', time: '2d ago', badgeVariant: 'green' as const, badgeLabel: 'Done' },
]

export function Overview() {
  const { user } = useAuth()
  const name = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'Athlete'

  return (
    <div className="px-10 py-10 max-w-5xl">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Dashboard</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">
          Good morning, {name}
        </h1>
        <p className="text-[#64748b] mt-2 text-sm">Your recruiting journey starts here.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {[
          { label: 'School Matches', value: '0', sub: 'of 5 free', color: 'text-[#eab308]' },
          { label: 'Emails Generated', value: '0', sub: 'of 3 free', color: 'text-[#eab308]' },
          { label: 'Coaches Contacted', value: '0', sub: null, color: 'text-[#4ade80]' },
          { label: 'Responses', value: '0', sub: null, color: 'text-[#60a5fa]' },
        ].map(({ label, value, sub, color }) => (
          <Card key={label} className="p-5">
            <div className={`font-serif text-3xl font-black ${color} tracking-[-1px]`}>{value}</div>
            <div className="text-xs text-[#64748b] mt-1">{label}</div>
            {sub && <div className="text-xs text-[rgba(255,255,255,0.2)] mt-0.5">{sub}</div>}
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-10">
        <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-5">Get started</h2>
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="no-underline">
              <Card hover className="p-6 h-full flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{action.icon}</span>
                  <Badge variant="gold">{action.badge}</Badge>
                </div>
                <div>
                  <div className="text-sm font-bold text-[#f1f5f9] mb-1">{action.title}</div>
                  <div className="text-xs text-[#64748b] leading-relaxed">{action.desc}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mb-10">
        <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-5">Recent activity</h2>
        <Card className="divide-y divide-[rgba(255,255,255,0.05)]">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1 text-sm text-[#f1f5f9]">{item.text}</div>
              <span className="text-xs text-[#64748b]">{item.time}</span>
              <Badge variant={item.badgeVariant}>{item.badgeLabel}</Badge>
            </div>
          ))}
        </Card>
      </div>

      {/* Upgrade banner */}
      <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(234,179,8,0.08),rgba(15,23,41,0.9))] border border-[rgba(234,179,8,0.2)] p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-bold text-[#eab308] mb-1">Upgrade to Pro — $19/mo</div>
          <div className="text-xs text-[#64748b]">Unlimited emails, outreach tracker, video rater, and follow-up assistant</div>
        </div>
        <Button size="sm">Upgrade Now</Button>
      </div>
    </div>
  )
}
