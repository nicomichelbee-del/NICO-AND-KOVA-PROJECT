import { useState } from 'react'
import { generateFollowUp } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Textarea'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { AthleteProfile } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

const EMAIL_TYPES = [
  { value: 'followup' as const, label: '2-Week Follow-up', desc: "Coach hasn't responded after 2 weeks" },
  { value: 'thankyou' as const, label: 'Thank You Note', desc: 'After a campus visit or phone call' },
  { value: 'answer' as const, label: 'Answer Coach Question', desc: "Respond to a coach's inquiry" },
]

const PLACEHOLDERS: Record<string, string> = {
  followup: 'e.g. Emailed Coach Smith at UNC Charlotte 2 weeks ago about the striker position. Haven\'t heard back.',
  thankyou: 'e.g. Just visited Notre Dame, met with Coach Williams, toured the facilities and training center.',
  answer: 'e.g. Coach asked about my academic interests and whether I\'m visiting other schools this fall.',
}

export function FollowUp() {
  const [type, setType] = useState<'followup' | 'thankyou' | 'answer'>('followup')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    setError(''); setLoading(true)
    try {
      const { body } = await generateFollowUp(profile, context, type)
      setResult(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate email')
    } finally { setLoading(false) }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-10 py-10 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Follow-up Assistant</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Follow-up Assistant</h1>
        <p className="text-[#64748b] mt-2 text-sm">Never stall a recruiting conversation. Always know exactly what to send next.</p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {EMAIL_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => { setType(t.value); setResult('') }}
            className={`p-4 rounded-xl border text-left transition-all ${
              type === t.value
                ? 'border-[#eab308] bg-[rgba(234,179,8,0.06)]'
                : 'border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(234,179,8,0.3)]'
            }`}
          >
            <div className={`text-sm font-bold mb-1 ${type === t.value ? 'text-[#eab308]' : 'text-[#f1f5f9]'}`}>{t.label}</div>
            <div className="text-xs text-[#64748b]">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <Textarea
            label="Context (optional but recommended)"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={PLACEHOLDERS[type]}
            rows={7}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Email'}
          </Button>
        </div>

        <div>
          {result ? (
            <Card className="p-5 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="green">✓ Ready to send</Badge>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? '✓ Copied' : 'Copy'}
                </Button>
              </div>
              <pre className="text-sm text-[#f1f5f9] whitespace-pre-wrap font-sans leading-relaxed flex-1 overflow-y-auto scrollbar-hide">
                {result}
              </pre>
            </Card>
          ) : (
            <Card className="p-12 h-full flex flex-col items-center justify-center text-center">
              <div className="text-3xl mb-3">💬</div>
              <div className="font-serif text-base font-bold text-[#f1f5f9] mb-1">Your email appears here</div>
              <p className="text-xs text-[#64748b]">Choose a type and click Generate</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
