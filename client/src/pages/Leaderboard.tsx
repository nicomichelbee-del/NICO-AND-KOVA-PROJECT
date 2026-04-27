import { Link } from 'react-router-dom'
import type { LeaderboardEntry } from '../types'

function loadLeaderboard(): LeaderboardEntry[] {
  try { return JSON.parse(localStorage.getItem('videoLeaderboard') ?? '[]') } catch { return [] }
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8
    ? 'text-[#4ade80] bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]'
    : score >= 6
    ? 'text-[#eab308] bg-[rgba(234,179,8,0.1)] border-[rgba(234,179,8,0.2)]'
    : 'text-[#f87171] bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.2)]'
  return (
    <span className={`px-3 py-1.5 rounded-lg border text-base font-black ${color}`}>{score.toFixed(1)}</span>
  )
}

export function Leaderboard() {
  const entries = loadLeaderboard()
  const rankMedal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

  return (
    <div className="min-h-screen bg-[#07090f] px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="flex items-center justify-center gap-2 font-serif text-lg font-bold text-[#f1f5f9] mb-12 no-underline">
          <div className="w-8 h-8 bg-[#eab308] rounded flex items-center justify-center text-sm">⚽</div>
          SoccerRecruit
        </Link>

        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🏆</div>
          <h1 className="font-serif text-4xl font-black text-[#f1f5f9] tracking-[-1px] mb-2">Top Highlight Videos</h1>
          <p className="text-[#64748b] text-sm">The highest-rated soccer recruitment highlight videos on SoccerRecruit</p>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-3xl mb-3">📭</div>
            <div className="font-serif text-xl font-bold text-[#f1f5f9] mb-2">No videos yet</div>
            <p className="text-sm text-[#64748b] mb-6">Be the first to submit your highlight video.</p>
            <Link
              to="/signup"
              className="inline-block px-6 py-2.5 bg-[#eab308] text-black font-semibold text-sm rounded-xl no-underline hover:bg-[#ca9a06] transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className={`p-5 rounded-2xl border flex items-center gap-5 ${
                  i === 0
                    ? 'bg-[rgba(234,179,8,0.06)] border-[rgba(234,179,8,0.25)]'
                    : i < 3
                    ? 'bg-[rgba(255,255,255,0.03)] border-[rgba(234,179,8,0.12)]'
                    : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.07)]'
                }`}
              >
                <div className="text-3xl w-12 text-center flex-shrink-0">{rankMedal(i)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#f1f5f9] text-base">{entry.athleteName}</div>
                  <div className="text-xs text-[#64748b] mt-0.5">
                    {entry.position} · {entry.clubTeam} · Class of {entry.gradYear} · {entry.divisionGoal} Goal
                  </div>
                </div>
                <ScoreBadge score={entry.score} />
                <a
                  href={entry.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.25)] rounded-xl text-sm text-[#60a5fa] font-semibold hover:bg-[rgba(59,130,246,0.2)] transition-colors no-underline"
                >
                  ▶ Watch
                </a>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-[#64748b] mt-12">
          Want your video here?{' '}
          <Link to="/signup" className="text-[#eab308] hover:underline">Create a free account</Link>
        </p>
      </div>
    </div>
  )
}
