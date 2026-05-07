import { useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { getCoachNotifPrefs, setCoachNotifPrefs } from '../../lib/api'

interface Props { coachUserId: string }

export function NotificationPrefs({ coachUserId }: Props) {
  const [perInbound, setPerInbound] = useState(false)
  const [dailyDigest, setDailyDigest] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCoachNotifPrefs(coachUserId)
      .then((p) => { setPerInbound(p.perInbound); setDailyDigest(p.dailyDigest) })
      .finally(() => setLoading(false))
  }, [coachUserId])

  async function toggle(key: 'perInbound' | 'dailyDigest', v: boolean) {
    if (key === 'perInbound') setPerInbound(v); else setDailyDigest(v)
    await setCoachNotifPrefs(coachUserId, { [key]: v })
  }

  if (loading) return null

  return (
    <Card className="p-6">
      <div className="text-xs font-mono uppercase tracking-[0.18em] text-[#f0b65a] mb-3">Email me when</div>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={perInbound} onChange={(e) => toggle('perInbound', e.target.checked)} className="accent-[#f0b65a]" />
          <span className="text-sm text-[#f5f1e8]">Every time a new athlete reaches out</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={dailyDigest} onChange={(e) => toggle('dailyDigest', e.target.checked)} className="accent-[#f0b65a]" />
          <span className="text-sm text-[#f5f1e8]">Once a day with a digest of new interest</span>
        </label>
      </div>
    </Card>
  )
}
