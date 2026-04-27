import { useState } from 'react'
import { rateVideo } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { AthleteProfile, VideoRating, LeaderboardEntry } from '../../types'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

function loadLeaderboard(): LeaderboardEntry[] {
  try { return JSON.parse(localStorage.getItem('videoLeaderboard') ?? '[]') } catch { return [] }
}
function saveLeaderboard(entries: LeaderboardEntry[]) {
  localStorage.setItem('videoLeaderboard', JSON.stringify(entries))
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
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="text-center z-10">
        <div className="font-serif text-3xl font-black leading-none" style={{ color }}>{score}</div>
        <div className="text-xs text-[#64748b]">/ 10</div>
      </div>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8
    ? 'text-[#4ade80] bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]'
    : score >= 6
    ? 'text-[#eab308] bg-[rgba(234,179,8,0.1)] border-[rgba(234,179,8,0.2)]'
    : 'text-[#f87171] bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.2)]'
  return (
    <span className={`px-2.5 py-1 rounded-lg border text-sm font-black ${color}`}>{score.toFixed(1)}</span>
  )
}

export function VideoRater() {
  const [tab, setTab] = useState<'rate' | 'leaderboard'>('rate')
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rating, setRating] = useState<VideoRating | null>(null)
  const [optIn, setOptIn] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(loadLeaderboard)

  async function handleRate() {
    const profile = getProfile()
    if (!profile?.name) { setError('Please complete your athlete profile first.'); return }
    if (!videoUrl) { setError('Please enter a video URL.'); return }
    setError(''); setLoading(true)
    try {
      const result = await rateVideo(videoUrl, profile)
      setRating(result)
      if (optIn && profile) {
        const entry: LeaderboardEntry = {
          id: crypto.randomUUID(),
          athleteName: profile.name,
          position: profile.position,
          clubTeam: profile.clubTeam,
          gradYear: profile.gradYear,
          divisionGoal: profile.targetDivision,
          score: result.score,
          videoUrl,
          ratedAt: new Date().toISOString(),
        }
        const updated = [...leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 10)
        setLeaderboard(updated)
        saveLeaderboard(updated)
      }
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

  const rankMedal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

  return (
    <div className="px-10 py-10 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#eab308]" />
          <span className="text-xs font-semibold tracking-[2px] uppercase text-[#eab308]">Video Rater</span>
        </div>
        <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px]">Highlight Video Rater</h1>
        <p className="text-[#64748b] mt-2 text-sm">Get an honest 1–10 rating and specific, actionable feedback on your highlight video.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[rgba(255,255,255,0.07)] mb-8">
        {[{ id: 'rate', label: 'Rate My Video' }, { id: 'leaderboard', label: '🏆 Leaderboard' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'rate' | 'leaderboard')}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[#eab308] text-[#eab308]'
                : 'border-transparent text-[#64748b] hover:text-[#f1f5f9]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rate' && (
        <>
          <Card className="p-6 mb-8">
            <Badge variant="gold" className="mb-4">Pro feature</Badge>
            <div className="flex gap-4 items-end flex-wrap mb-4">
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
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="w-4 h-4 accent-[#eab308]"
              />
              <span className="text-xs text-[#64748b]">
                Add my video to the public leaderboard (name, position, club, and video link will be visible)
              </span>
            </label>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
          </Card>

          {rating && (
            <div className="flex flex-col gap-6">
              <Card className="p-6 flex items-start gap-8 flex-wrap">
                <ScoreRing score={rating.score} />
                <div className="flex-1 min-w-48">
                  <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">Overall Assessment</div>
                  <p className="text-sm text-[#64748b] leading-relaxed">{rating.summary}</p>
                </div>
              </Card>

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
        </>
      )}

      {tab === 'leaderboard' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-serif text-xl font-bold text-[#f1f5f9]">Top 10 Highlight Videos</div>
              <p className="text-xs text-[#64748b] mt-0.5">
                Publicly visible · Opt-in only ·{' '}
                <a href="/leaderboard" target="_blank" className="text-[#eab308] hover:underline">Share public link ↗</a>
              </p>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <Card className="p-16 text-center">
              <div className="text-4xl mb-4">🏆</div>
              <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">No videos on the leaderboard yet</div>
              <p className="text-sm text-[#64748b] max-w-xs mx-auto">
                Rate your video and check "Add to leaderboard" to appear here.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {leaderboard.map((entry, i) => (
                <Card key={entry.id} className={`p-5 flex items-center gap-5 ${i < 3 ? 'border-[rgba(234,179,8,0.2)]' : ''}`}>
                  <div className="text-2xl w-10 text-center flex-shrink-0">{rankMedal(i)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#f1f5f9]">{entry.athleteName}</div>
                    <div className="text-xs text-[#64748b]">
                      {entry.position} · {entry.clubTeam} · Class {entry.gradYear} · {entry.divisionGoal} Goal
                    </div>
                  </div>
                  <ScoreBadge score={entry.score} />
                  <a
                    href={entry.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] rounded-lg text-xs text-[#60a5fa] hover:bg-[rgba(59,130,246,0.2)] transition-colors no-underline"
                  >
                    ▶ Watch
                  </a>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
