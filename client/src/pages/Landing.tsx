import { Link } from 'react-router-dom'
import { Nav } from '../components/layout/Nav'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { BeekoLogo } from '../components/ui/BeekoLogo'

const features = [
  { num: '01', icon: '🏟️', title: 'Athlete Profile Builder', desc: 'Position, stats, GPA, club team, and highlight link — the foundation everything else is built on.', tier: 'FREE' },
  { num: '02', icon: '🎯', title: 'School Matcher', desc: 'Reach, target, and safety schools ranked by fit — based on your real stats, not generic rankings.', tier: 'FREE' },
  { num: '03', icon: '✉️', title: 'Coach Email Generator', desc: 'AI writes personalized cold outreach for each division. D1 = stat-heavy. D3 = academic fit. NAIA = playing time.', tier: 'FREE · 3 EMAILS' },
  { num: '04', icon: '📊', title: 'Outreach Tracker', desc: 'Track every contact, response, and next step. Never let a warm lead go cold.', tier: 'PRO' },
  { num: '05', icon: '💬', title: 'Follow-up Assistant', desc: 'AI drafts follow-ups, thank-you notes, and answers to coach questions — always the right tone.', tier: 'PRO' },
  { num: '06', icon: '🎬', title: 'Highlight Video Rater', desc: 'Submit your YouTube or Hudl URL. Get a 1–10 score and specific, actionable improvement points.', tier: 'PRO' },
]

const plans = [
  {
    tier: 'Free', price: '0', period: 'Forever free',
    items: ['Athlete profile builder', '5 school matches', '3 coach emails', 'Division guidance'],
    cta: 'Get Started', featured: false,
  },
  {
    tier: 'Pro', price: '19', period: 'per month · cancel anytime',
    items: ['Everything in Free', 'Unlimited coach emails', 'Outreach tracker dashboard', 'Follow-up assistant', 'Highlight video rater'],
    cta: 'Start Pro', featured: true,
  },
  {
    tier: 'Family', price: '29', period: 'per month · cancel anytime',
    items: ['Everything in Pro', 'Parent dashboard view', 'Shared recruiting timeline', 'Progress notifications'],
    cta: 'Start Family', featured: false,
  },
]

const steps = [
  { num: '01', title: 'Build your athlete profile', desc: 'Enter your position, GPA, club team, stats, grad year, and target division. Add your highlight video link.', tier: 'FREE' },
  { num: '02', title: 'Get matched to schools', desc: 'AI matches you to reach, target, and safety schools based on your real stats — not generic ranking lists.', tier: 'FREE' },
  { num: '03', title: 'Send coach emails that work', desc: 'AI writes personalized cold outreach for each coach. D1 emails are stat-heavy. D2/D3 emphasize academic fit.', tier: 'FREE · 3 EMAILS' },
  { num: '04', title: 'Track, follow up, get offers', desc: 'Manage every contact and response in your outreach dashboard. Let AI draft your follow-ups and thank-you notes.', tier: 'PRO' },
]

export function Landing() {
  return (
    <div className="min-h-screen bg-[#07090f]">
      <Nav />

      {/* Hero */}
      <section className="relative flex items-center justify-center overflow-hidden px-8 md:px-16 pt-40 pb-24">
        <div
          className="absolute inset-0 bg-gold-grid opacity-60"
          style={{ maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)' }}
        />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(234,179,8,0.08)_0%,transparent_65%)] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        <div className="relative text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-9">
            <div className="w-8 h-px bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[3px] uppercase text-[#eab308]">AI-Powered College Soccer Recruitment</span>
            <div className="w-8 h-px bg-[#eab308]" />
          </div>

          <div className="flex justify-center mb-6">
            <BeekoLogo size={80} showText={false} />
          </div>
          <h1 className="font-serif text-6xl md:text-7xl font-black leading-[1.0] tracking-[-3px] text-[#f1f5f9] mb-7">
            The <em className="text-[#eab308] not-italic">smartest</em> way to<br />get recruited
          </h1>

          <p className="text-lg text-[#64748b] leading-[1.8] max-w-xl mx-auto mb-14">
            Meet <strong className="text-[#f1f5f9]">Beeko</strong> — your AI recruiting counselor with 15+ years of D1–NAIA soccer knowledge. Build your profile, match your schools, and land in coaches' inboxes.
          </p>

          <div className="flex gap-4 justify-center items-center flex-wrap">
            <Link to="/signup"><Button size="lg">Start for Free</Button></Link>
            <Button variant="ghost" size="lg">See how it works →</Button>
          </div>

          <div className="flex gap-12 justify-center mt-16 pt-12 border-t border-[rgba(255,255,255,0.07)] flex-wrap">
            {[
              { num: '1,200+', label: 'Athletes recruited' },
              { num: '3×', label: 'More coach responses' },
              { num: 'D1–NAIA', label: 'All divisions covered' },
            ].map(({ num, label }) => (
              <div key={label} className="text-center">
                <div className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">
                  {num.includes('+') ? <>{num.slice(0, -1)}<span className="text-[#eab308]">+</span></>
                    : num.includes('×') ? <>{num.slice(0, -1)}<span className="text-[#eab308]">×</span></>
                    : <>{num.split('–')[0]}<span className="text-[#eab308]">–</span>{num.split('–')[1]}</>}
                </div>
                <div className="text-sm text-[#64748b] mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <div className="bg-[#0f1729] border-y border-[rgba(255,255,255,0.07)] overflow-x-auto">
        <div className="flex items-center px-8 md:px-16 py-4 min-w-max">
          {features.map((f, i) => (
            <div
              key={f.num}
              className={`flex items-center gap-3 px-8 whitespace-nowrap ${i < features.length - 1 ? 'border-r border-[rgba(255,255,255,0.07)]' : ''}`}
            >
              <span className="text-base">{f.icon}</span>
              <span className="text-sm font-medium text-[#f1f5f9]">{f.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="py-24 px-8 md:px-16" id="how-it-works">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[3px] uppercase text-[#eab308]">Process</span>
          </div>
          <h2 className="font-serif text-5xl font-black tracking-[-1.5px] text-[#f1f5f9] mb-3 leading-[1.1]">How it works</h2>
          <p className="text-base text-[#64748b] max-w-md leading-[1.75] mb-14">
            From blank profile to coach response in four steps.
          </p>
          <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.07)]">
            {steps.map((step) => (
              <div key={step.num} className="grid grid-cols-[80px_1fr] gap-8 py-9 items-start">
                <div className="font-serif text-5xl font-black text-[#eab308] opacity-40 leading-none">{step.num}</div>
                <div>
                  <div className="text-lg font-bold text-[#f1f5f9] mb-2">{step.title}</div>
                  <p className="text-sm text-[#64748b] leading-[1.7]">{step.desc}</p>
                  <Badge variant="gold" className="mt-3">{step.tier}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-24 bg-[#0c1118] px-8 md:px-16" id="features">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[3px] uppercase text-[#eab308]">Features</span>
          </div>
          <h2 className="font-serif text-5xl font-black tracking-[-1.5px] text-[#f1f5f9] mb-4 leading-[1.1]">Everything in one place</h2>
          <p className="text-base text-[#64748b] max-w-md leading-[1.75] mb-14">
            Six tools built on 15+ years of soccer recruiting knowledge.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.05)] rounded-2xl overflow-hidden">
            {features.map((f) => (
              <div key={f.num} className="bg-[#0c1118] p-8 hover:bg-[rgba(234,179,8,0.04)] transition-colors">
                <div className="font-serif text-xs font-bold tracking-widest text-[#eab308] opacity-60 mb-5">{f.num}</div>
                <div className="text-base font-bold text-[#f1f5f9] mb-2">{f.title}</div>
                <p className="text-sm text-[#64748b] leading-[1.7]">{f.desc}</p>
                <Badge variant="gold" className="mt-4">{f.tier}</Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-8 md:px-16" id="pricing">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-[#eab308]" />
            <span className="text-xs font-semibold tracking-[3px] uppercase text-[#eab308]">Pricing</span>
          </div>
          <h2 className="font-serif text-5xl font-black tracking-[-1.5px] text-[#f1f5f9] mb-3 leading-[1.1]">Straightforward pricing</h2>
          <p className="text-base text-[#64748b] max-w-sm leading-[1.75] mb-14">Start free. No credit card required.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.tier}
                className={`relative rounded-2xl p-9 border transition-colors ${
                  plan.featured
                    ? 'border-[#eab308] bg-[linear-gradient(145deg,rgba(234,179,8,0.06),rgba(7,9,15,0.9))]'
                    : 'border-[rgba(234,179,8,0.15)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(234,179,8,0.3)]'
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#eab308] text-black text-[10px] font-black px-4 py-1 rounded">
                    MOST POPULAR
                  </div>
                )}
                <div className={`text-xs font-bold tracking-[2px] uppercase mb-4 ${plan.featured ? 'text-[#eab308]' : 'text-[#64748b]'}`}>
                  {plan.tier}
                </div>
                <div className="font-serif text-5xl font-black text-[#f1f5f9] tracking-[-2px] leading-none mb-1.5">
                  <sup className="text-2xl font-bold font-sans align-super">$</sup>{plan.price}
                </div>
                <div className="text-xs text-[#64748b] mb-7">{plan.period}</div>
                <ul className="flex flex-col gap-3 mb-8 list-none p-0 m-0">
                  {plan.items.map((item) => (
                    <li key={item} className="text-sm text-[#f1f5f9] flex items-center gap-2.5">
                      <span className="text-[#eab308] font-bold">—</span> {item}
                    </li>
                  ))}
                </ul>
                <Link to="/signup">
                  <Button variant={plan.featured ? 'gold' : 'outline'} className="w-full">{plan.cta}</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 px-8 md:px-16 text-center bg-[#0f1729] border-t border-[rgba(255,255,255,0.07)] overflow-hidden">
        <div
          className="absolute inset-0 bg-gold-grid opacity-40"
          style={{ maskImage: 'radial-gradient(ellipse 70% 70% at 50% 100%, black 0%, transparent 100%)' }}
        />
        <div className="relative">
          <h2 className="font-serif text-5xl md:text-6xl font-black tracking-[-2px] text-[#f1f5f9] leading-[1.05] mb-5">
            Your offer is out there.<br />Go <em className="text-[#eab308] not-italic">find it.</em>
          </h2>
          <p className="text-lg text-[#64748b] mb-12">
            D1 coaches make most offers sophomore and junior year. The clock is running.
          </p>
          <Link to="/signup"><Button size="lg">Create Your Free Profile</Button></Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 md:px-16 py-9 border-t border-[rgba(255,255,255,0.07)] flex items-center justify-between flex-wrap gap-4">
        <BeekoLogo size={28} textClassName="font-serif text-base font-bold text-[#64748b]" />
        <div className="text-xs text-[#64748b]">© 2025 Beeko AI. All rights reserved.</div>
      </footer>
    </div>
  )
}
