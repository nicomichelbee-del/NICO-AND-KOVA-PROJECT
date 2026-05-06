import { useState, useEffect, useRef } from 'react'
import { rateVideo } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/PageHeader'
import { readLegacyProfile } from '../../lib/profileAdapter'
import type { AthleteProfile, VideoRating, VideoFrame, LeaderboardEntry } from '../../types'

function getProfile(): AthleteProfile | null {
  return readLegacyProfile()
}
function loadLeaderboard(): LeaderboardEntry[] {
  try { return JSON.parse(localStorage.getItem('videoLeaderboard') ?? '[]') } catch { return [] }
}
function saveLeaderboard(entries: LeaderboardEntry[]) {
  localStorage.setItem('videoLeaderboard', JSON.stringify(entries))
}
function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

const PROGRESS_STEPS = [
  { label: 'Opening YouTube...', detail: 'Launching headless browser' },
  { label: 'Capturing video frames...', detail: 'Seeking through the video and taking screenshots' },
  { label: 'Analyzing footage with AI...', detail: 'Claude Vision is reviewing every frame' },
  { label: 'Building your report...', detail: 'Generating position-specific feedback' },
]
// Approximate seconds at which each step starts
const STEP_AT = [0, 10, 35, 75]

function LoadingModal({ loading }: { loading: boolean }) {
  const [step, setStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (loading) {
      setStep(0); setElapsed(0)
      startRef.current = Date.now()
      timerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startRef.current) / 1000)
        setElapsed(sec)
        let nextStep = 0
        for (let i = STEP_AT.length - 1; i >= 0; i--) { if (sec >= STEP_AT[i]) { nextStep = i; break } }
        setStep(Math.min(nextStep, PROGRESS_STEPS.length - 1))
      }, 500)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loading])

  if (!loading) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full">
        <div className="flex flex-col items-center text-center">
          <div className="relative w-24 h-24 mb-6">
            <svg className="w-full h-full animate-spin" viewBox="0 0 50 50">
              <circle
                cx="25" cy="25" r="20"
                fill="none"
                stroke="rgba(245,241,232,0.08)"
                strokeWidth="4"
              />
              <circle
                cx="25" cy="25" r="20"
                fill="none"
                stroke="#f0b65a"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="90 200"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-[#f0b65a]">
              {elapsed}s
            </div>
          </div>
          <div className="font-serif text-xl font-bold text-[#f5f1e8] mb-1">
            Analyzing your highlight reel
          </div>
          <p className="text-sm text-[#94a3b8] mb-1">{PROGRESS_STEPS[step].label}</p>
          <p className="text-xs text-[#475569] mb-6">{PROGRESS_STEPS[step].detail}</p>
          <div className="flex gap-2 w-full">
            {PROGRESS_STEPS.map((s, i) => (
              <div key={i} className="flex-1 flex flex-col gap-1.5">
                <div className={`h-1 rounded-full transition-all duration-500 ${
                  i < step ? 'bg-[#f0b65a]' : i === step ? 'bg-[#f0b65a] opacity-60' : 'bg-[rgba(245,241,232,0.08)]'
                }`} />
                <span className={`text-[10px] leading-tight ${i <= step ? 'text-[#94a3b8]' : 'text-[#334155]'}`}>
                  {s.label.replace('...', '')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

function Filmstrip({ frames }: { frames: VideoFrame[] }) {
  const [enlarged, setEnlarged] = useState<VideoFrame | null>(null)
  if (!frames.length) return null
  return (
    <>
      <div className="mb-6">
        <div className="text-xs font-semibold text-[#9a9385] uppercase tracking-wider mb-2">
          Captured Frames · {frames.length} screenshots
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {frames.map((f) => (
            <button
              key={f.timestamp}
              onClick={() => setEnlarged(f)}
              className="flex-shrink-0 flex flex-col items-center gap-1 group"
            >
              <img
                src={`data:image/jpeg;base64,${f.data}`}
                alt={`Frame at ${fmtTime(f.timestamp)}`}
                className="w-32 h-18 object-cover rounded-lg border border-[rgba(245,241,232,0.08)] group-hover:border-[rgba(240,182,90,0.45)] transition-colors"
                style={{ height: '72px' }}
              />
              <span className="text-[10px] text-[#475569] font-mono">{fmtTime(f.timestamp)}</span>
            </button>
          ))}
        </div>
      </div>

      {enlarged && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setEnlarged(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img
              src={`data:image/jpeg;base64,${enlarged.data}`}
              alt={`Frame at ${fmtTime(enlarged.timestamp)}`}
              className="w-full rounded-2xl border border-[rgba(245,241,232,0.10)]"
            />
            <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/70 rounded-lg text-xs text-white font-mono">
              {fmtTime(enlarged.timestamp)}
            </div>
            <button
              onClick={() => setEnlarged(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/70 rounded-full text-white text-lg flex items-center justify-center hover:bg-black/90"
            >
              ×
            </button>
            <div className="flex justify-center gap-2 mt-3">
              {frames.map((f) => (
                <button
                  key={f.timestamp}
                  onClick={() => setEnlarged(f)}
                  className={`w-2 h-2 rounded-full transition-colors ${f.timestamp === enlarged.timestamp ? 'bg-[#f0b65a]' : 'bg-[rgba(245,241,232,0.20)]'}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const filled = (score / 10) * circ
  const color = score >= 8 ? '#4ade80' : score >= 6 ? '#f0b65a' : '#f87171'
  return (
    <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(245,241,232,0.08)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="text-center z-10">
        <div className="font-serif text-3xl font-black leading-none" style={{ color }}>{score.toFixed(1)}</div>
        <div className="text-xs text-[#9a9385]">/ 10</div>
      </div>
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8
    ? 'text-[#4ade80] bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]'
    : score >= 6
    ? 'text-[#f0b65a] bg-[rgba(240,182,90,0.10)] border-[rgba(240,182,90,0.25)]'
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
    if (!/youtube\.com|youtu\.be/.test(videoUrl)) { setError('Only YouTube URLs are supported.'); return }
    setError(''); setRating(null); setLoading(true)
    try {
      const result = await rateVideo(videoUrl, profile)
      setRating(result)
      // Persist the latest rating so the school matcher can incorporate
      // tape-derived skill into per-school athletic fit. Stored under a
      // stable key the matcher reads from.
      try { localStorage.setItem('latestVideoRating', JSON.stringify(result)) } catch { /* quota / private mode */ }
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
      setError(e instanceof Error ? e.message : 'Failed to analyze video')
    } finally { setLoading(false) }
  }

  const criteria = rating ? [
    { label: 'Technical quality', value: rating.technical, score: rating.technicalScore },
    { label: 'Tactical awareness', value: rating.tactical, score: rating.tacticalScore },
    { label: 'Composure', value: rating.composure, score: rating.composureScore },
    { label: 'Position play', value: rating.positionPlay, score: rating.positionPlayScore },
    { label: 'Division fit', value: rating.divisionFit, score: rating.divisionFitScore },
  ] : []

  const rankMedal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

  return (
    <div className="kr-page max-w-4xl">
      <PageHeader
        eyebrow="Highlight video rater · Pro"
        title={<>The reel <span className="kr-accent">coaches</span> remember.</>}
        lede="AI watches your actual video — seeks through every minute, captures screenshots, and gives you the kind of feedback a coach would give."
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[rgba(245,241,232,0.08)] mb-8">
        {[{ id: 'rate', label: 'Rate my video' }, { id: 'leaderboard', label: 'Leaderboard' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'rate' | 'leaderboard')}
            className={`px-5 py-3 font-mono text-[11px] tracking-[0.18em] uppercase border-b-2 transition-[color,border-color] -mb-px ${
              tab === t.id
                ? 'border-gold text-gold'
                : 'border-transparent text-ink-2 hover:text-ink-0'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rate' && (
        <>
          <Card className="p-6 mb-6">
            <Badge variant="gold" className="mb-4">Pro feature</Badge>
            <div className="flex gap-4 items-end flex-wrap mb-4">
              <div className="flex-1 min-w-64">
                <Input
                  label="YouTube video URL"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <Button onClick={handleRate} disabled={loading}>
                {loading ? 'Analyzing...' : 'Rate My Video'}
              </Button>
            </div>
            <p className="text-xs text-[#475569]">
              AI opens your video, captures up to 48 screenshots across the whole thing, stitches them into grid montages, and sends them to Claude Vision for a full breakdown — so no clip gets missed. Takes ~1–2 minutes. YouTube only.
            </p>
            <div className="mt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="w-4 h-4 accent-[#f0b65a]"
                />
                <span className="text-xs text-[#9a9385]">
                  Add my video to the public leaderboard (name, position, club, and video link will be visible)
                </span>
              </label>
            </div>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
          </Card>

          <LoadingModal loading={loading} />

          {rating && (
            <div className="flex flex-col gap-6">
              {/* Overall assessment with first frame */}
              <Card className="p-6">
                {rating.videoTitle && (
                  <div className="text-xs text-[#475569] mb-4 truncate">"{rating.videoTitle}"</div>
                )}
                <div className="flex items-start gap-6 flex-wrap">
                  <ScoreRing score={rating.score} />
                  {rating.screenshots?.[0] && (
                    <img
                      src={`data:image/jpeg;base64,${rating.screenshots[0].data}`}
                      alt="Opening frame"
                      className="w-40 rounded-xl border border-[rgba(245,241,232,0.08)] object-cover flex-shrink-0"
                      style={{ height: '90px' }}
                    />
                  )}
                  <div className="flex-1 min-w-48">
                    <div className="font-serif text-xl font-bold text-[#f5f1e8] mb-2">Overall Assessment</div>
                    {rating.detectedPosition && (
                      <div className="mb-2 inline-flex items-center gap-2 px-2.5 py-1 bg-[rgba(240,182,90,0.08)] border border-[rgba(240,182,90,0.25)] rounded-lg">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#f0b65a]">Detected on tape</span>
                        <span className="text-xs text-[#f5f1e8]">{rating.detectedPosition}</span>
                      </div>
                    )}
                    <p className="text-sm text-[#9a9385] leading-relaxed">{rating.summary}</p>
                    {rating.duration && rating.duration > 0 && (
                      <div className="mt-2 text-xs text-[#475569]">
                        Duration: {fmtTime(rating.duration)}
                        {rating.duration >= 180 && rating.duration <= 300
                          ? ' · ideal length'
                          : rating.duration > 300
                          ? ' · consider trimming to 3–5 min'
                          : ' · shorter than ideal'}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Filmstrip */}
              {(rating.screenshots?.length ?? 0) > 0 && (
                <Filmstrip frames={rating.screenshots!} />
              )}

              {/* Detailed feedback */}
              <div>
                <h2 className="font-serif text-xl font-bold text-[#f5f1e8] mb-4">Detailed Feedback</h2>
                <div className="grid grid-cols-2 gap-3">
                  {criteria.map(({ label, value, score }) => (
                    <Card key={label} className="p-4">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="text-xs font-semibold text-[#f0b65a] uppercase tracking-wider">{label}</div>
                        {typeof score === 'number' && Number.isFinite(score) && <ScoreBadge score={score} />}
                      </div>
                      <p className="text-sm text-[#9a9385] leading-relaxed">{value}</p>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Priority improvements */}
              {(rating.improvements?.length ?? 0) > 0 && (
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#f5f1e8] mb-4">Priority Improvements</h2>
                  <div className="flex flex-col gap-3">
                    {(rating.improvements ?? []).map((item, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 bg-[rgba(234,179,8,0.04)] border border-[rgba(240,182,90,0.18)] rounded-xl">
                        <span className="font-serif text-lg font-black text-[#f0b65a] opacity-50 leading-none mt-0.5 flex-shrink-0">{i + 1}</span>
                        <p className="text-sm text-[#f5f1e8] leading-relaxed">{item}</p>
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
              <div className="font-serif text-xl font-bold text-[#f5f1e8] mb-2">Submit your video</div>
              <p className="text-sm text-[#9a9385] max-w-xs mx-auto">
                Paste a YouTube link. AI watches the actual video, captures up to 48 frames across it as grid montages, and gives you real coach-level feedback.
              </p>
            </Card>
          )}
        </>
      )}

      {tab === 'leaderboard' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-serif text-xl font-bold text-[#f5f1e8]">Top 10 Highlight Videos</div>
              <p className="text-xs text-[#9a9385] mt-0.5">
                Publicly visible · Opt-in only ·{' '}
                <a href="/leaderboard" target="_blank" className="text-[#f0b65a] hover:underline">Share public link ↗</a>
              </p>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <Card className="p-16 text-center">
              <div className="text-4xl mb-4">🏆</div>
              <div className="font-serif text-xl font-bold text-[#f5f1e8] mb-2">No videos on the leaderboard yet</div>
              <p className="text-sm text-[#9a9385] max-w-xs mx-auto">
                Rate your video and check "Add to leaderboard" to appear here.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {leaderboard.map((entry, i) => (
                <Card key={entry.id} className={`p-5 flex items-center gap-5 ${i < 3 ? 'border-[rgba(240,182,90,0.25)]' : ''}`}>
                  <div className="text-2xl w-10 text-center flex-shrink-0">{rankMedal(i)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#f5f1e8]">{entry.athleteName}</div>
                    <div className="text-xs text-[#9a9385]">
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
