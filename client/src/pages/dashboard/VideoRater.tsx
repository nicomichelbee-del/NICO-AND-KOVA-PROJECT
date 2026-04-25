import { useState } from 'react'
import { rateVideo } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { AthleteProfile, VideoRating } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

function ScoreRing({ score }: { score: number }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const filled = (score / 10) * circ
  const color = score >= 8 ? '#4ade80' : score >= 6 ? '#eab308' : '#f87171'
  return (
    <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        />
      </svg>
      <div className="text-center z-10">
        <div className="font-serif text-3xl font-black leading-none" style={{ color }}>{score}</div>
        <div className="text-xs text-[#64748b]">/ 10</div>
      </div>
    </div>
  )
}

export function VideoRater() {
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rating, setRating] = useState<VideoRating | null>(null)

  async function handleRate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!videoUrl) { setError('Please enter a video URL.'); return }
    setError(''); setLoading(true)
    try {
      const result = await rateVideo(videoUrl, profile)
      setRating(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rate video')
    } finally { setLoading(false) }
  }

  const criteria = rating ? [
    { label: 'Opening clip (first 30s)', value: rating.openingClip },
    { label: 'Clip variety', value: rating.clipVariety },
    { label: 'Video length', value: rating.videoLength },
    { label: 'Production quality', value: rating.production },
    { label: 'Stat / info overlay', value: rating.statOverlay },
    { label: 'Position-specific skills', value: rating.positionSkills },
  ] : []

  return (
    <div className="px-10 py-10 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Video Rater</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Highlight Video Rater</h1>
        <p className="text-[#64748b] mt-2 text-sm">Get an honest 1–10 rating and specific, actionable feedback on your highlight video.</p>
        <Badge variant="gold" className="mt-3">Pro feature</Badge>
      </div>

      <Card className="p-6 mb-8">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-64">
            <Input
              label="YouTube or Hudl video URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
          <Button onClick={handleRate} disabled={loading}>
            {loading ? 'Analyzing...' : 'Rate My Video'}
          </Button>
        </div>
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </Card>

      {rating && (
        <div className="flex flex-col gap-6">
          {/* Score + summary */}
          <Card className="p-6 flex items-start gap-8 flex-wrap">
            <ScoreRing score={rating.score} />
            <div className="flex-1 min-w-48">
              <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Overall Assessment</div>
              <p className="text-sm text-[#64748b] leading-relaxed">{rating.summary}</p>
            </div>
          </Card>

          {/* Criteria breakdown */}
          <div>
            <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-4">Detailed Feedback</h2>
            <div className="grid grid-cols-2 gap-3">
              {criteria.map(({ label, value }) => (
                <Card key={label} className="p-4">
                  <div className="text-xs font-semibold text-[#eab308] uppercase tracking-wider mb-2">{label}</div>
                  <p className="text-sm text-[#64748b] leading-relaxed">{value}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Priority improvements */}
          {rating.improvements.length > 0 && (
            <div>
              <h2 className="font-serif text-xl font-bold text-[#f1f5f9] mb-4">Priority Improvements</h2>
              <div className="flex flex-col gap-3">
                {rating.improvements.map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-[rgba(234,179,8,0.04)] border border-[rgba(234,179,8,0.15)] rounded-xl">
                    <span className="font-serif text-lg font-black text-[#eab308] opacity-50 leading-none mt-0.5 flex-shrink-0">{i + 1}</span>
                    <p className="text-sm text-[#f1f5f9] leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !rating && (
        <Card className="p-16 text-center">
          <div className="text-4xl mb-4">🎬</div>
          <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Submit your video</div>
          <p className="text-sm text-[#64748b] max-w-xs mx-auto">
            Paste your YouTube or Hudl link above. AI analyzes opening clips, variety, length, production, and position-specific skills.
          </p>
        </Card>
      )}
    </div>
  )
}
