import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import type { AthleteProfile, Division } from '../../types'

const POSITIONS = ['Goalkeeper', 'Center Back', 'Right Back', 'Left Back', 'Defensive Mid', 'Central Mid', 'Attacking Mid', 'Right Wing', 'Left Wing', 'Striker']
const DIVISIONS: Division[] = ['D1', 'D2', 'D3', 'NAIA', 'JUCO']

const defaultProfile: AthleteProfile = {
  name: '', gradYear: 2026, position: '', clubTeam: '', clubLeague: '',
  gpa: 0, satAct: '', goals: 0, assists: 0, season: '2024-25',
  intendedMajor: '', highlightUrl: '', targetDivision: 'D2',
  locationPreference: 'any', sizePreference: 'any',
}

export function Profile() {
  const [profile, setProfile] = useState<AthleteProfile>(() => {
    try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') }
    catch { return defaultProfile }
  })
  const [saved, setSaved] = useState(false)

  function update<K extends keyof AthleteProfile>(field: K, value: AthleteProfile[K]) {
    setProfile((p) => ({ ...p, [field]: value }))
    setSaved(false)
  }

  function handleSave() {
    localStorage.setItem('athleteProfile', JSON.stringify(profile))
    setSaved(true)
  }

  const selectClass = "w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-2.5 text-sm text-[#f1f5f9] focus:outline-none focus:border-[#eab308] appearance-none"

  return (
    <div className="px-10 py-10 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Profile</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Athlete Profile</h1>
        <p className="text-[#64748b] mt-2 text-sm">This profile powers your school matches and coach emails.</p>
      </div>

      <div className="flex flex-col gap-8">
        {/* Personal */}
        <section>
          <h2 className="text-xs font-bold text-[#64748b] tracking-[2px] uppercase mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">Personal Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full name" value={profile.name} onChange={(e) => update('name', e.target.value)} placeholder="Alex Johnson" />
            <Input label="Graduation year" type="number" value={profile.gradYear} onChange={(e) => update('gradYear', parseInt(e.target.value) || 2026)} placeholder="2026" />
          </div>
        </section>

        {/* Soccer */}
        <section>
          <h2 className="text-xs font-bold text-[#64748b] tracking-[2px] uppercase mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">Soccer</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#f1f5f9]">Position</label>
              <select value={profile.position} onChange={(e) => update('position', e.target.value)} className={selectClass}>
                <option value="">Select position</option>
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Input label="Season (e.g. 2024-25)" value={profile.season} onChange={(e) => update('season', e.target.value)} placeholder="2024-25" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Goals" type="number" value={profile.goals} onChange={(e) => update('goals', parseInt(e.target.value) || 0)} placeholder="12" />
            <Input label="Assists" type="number" value={profile.assists} onChange={(e) => update('assists', parseInt(e.target.value) || 0)} placeholder="8" />
            <Input label="Highlight video URL" value={profile.highlightUrl} onChange={(e) => update('highlightUrl', e.target.value)} placeholder="youtube.com/..." />
          </div>
        </section>

        {/* Club */}
        <section>
          <h2 className="text-xs font-bold text-[#64748b] tracking-[2px] uppercase mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">Club Team</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Club team name" value={profile.clubTeam} onChange={(e) => update('clubTeam', e.target.value)} placeholder="FC Dallas Academy" />
            <Input label="Club league" value={profile.clubLeague} onChange={(e) => update('clubLeague', e.target.value)} placeholder="ECNL, MLS Next, USYS..." />
          </div>
        </section>

        {/* Academic */}
        <section>
          <h2 className="text-xs font-bold text-[#64748b] tracking-[2px] uppercase mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">Academics</h2>
          <div className="grid grid-cols-3 gap-4">
            <Input label="GPA (unweighted)" type="number" step="0.01" min="0" max="4" value={profile.gpa} onChange={(e) => update('gpa', parseFloat(e.target.value) || 0)} placeholder="3.7" />
            <Input label="SAT / ACT score" value={profile.satAct ?? ''} onChange={(e) => update('satAct', e.target.value)} placeholder="1280 / 29" />
            <Input label="Intended major" value={profile.intendedMajor} onChange={(e) => update('intendedMajor', e.target.value)} placeholder="Business" />
          </div>
        </section>

        {/* Recruiting goals */}
        <section>
          <h2 className="text-xs font-bold text-[#64748b] tracking-[2px] uppercase mb-4 pb-3 border-b border-[rgba(255,255,255,0.07)]">Recruiting Goals</h2>
          <div className="mb-4">
            <label className="text-sm font-medium text-[#f1f5f9] block mb-2">Target division</label>
            <div className="flex gap-2 flex-wrap">
              {DIVISIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => update('targetDivision', d)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    profile.targetDivision === d
                      ? 'bg-[#eab308] text-black border-[#eab308]'
                      : 'bg-transparent text-[#64748b] border-[rgba(255,255,255,0.1)] hover:border-[#eab308] hover:text-[#eab308]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Location preference" value={profile.locationPreference} onChange={(e) => update('locationPreference', e.target.value)} placeholder="Southeast, Texas, any..." />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#f1f5f9]">School size</label>
              <select value={profile.sizePreference} onChange={(e) => update('sizePreference', e.target.value as AthleteProfile['sizePreference'])} className={selectClass}>
                <option value="any">Any size</option>
                <option value="small">Small (&lt;5k)</option>
                <option value="medium">Medium (5k–15k)</option>
                <option value="large">Large (&gt;15k)</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-4 pt-2">
          <Button onClick={handleSave}>Save Profile</Button>
          {saved && <Badge variant="green">✓ Saved</Badge>}
        </div>
      </div>
    </div>
  )
}
