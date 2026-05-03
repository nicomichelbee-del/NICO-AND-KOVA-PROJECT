import { Link } from 'react-router-dom'
import { KickrIQLogo } from '../components/ui/KickrIQLogo'
import type { LeaderboardEntry } from '../types'

function loadLeaderboard(): LeaderboardEntry[] {
  try { return JSON.parse(localStorage.getItem('videoLeaderboard') ?? '[]') } catch { return [] }
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 8 ? 'text-pitch-light bg-[rgba(78,163,110,0.10)] border-[rgba(78,163,110,0.30)]' :
    score >= 6 ? 'text-gold bg-[rgba(240,182,90,0.10)] border-[rgba(240,182,90,0.30)]' :
                 'text-crimson-light bg-[rgba(227,90,90,0.10)] border-[rgba(227,90,90,0.30)]'
  return (
    <div className={`px-3.5 py-2 rounded-xl border ${tone}`}>
      <div className="font-serif text-[22px] leading-none tabular-nums" style={{ fontVariationSettings: '"opsz" 144' }}>{score.toFixed(1)}</div>
    </div>
  )
}

function rankMedal(i: number) {
  if (i < 3) {
    const tone = i === 0 ? 'text-gold' : i === 1 ? 'text-ink-1' : 'text-[#c47a16]'
    return <span className={`font-serif text-[28px] leading-none ${tone}`} style={{ fontVariationSettings: '"opsz" 144, "WONK" 1' }}>{(i + 1).toString().padStart(2, '0')}</span>
  }
  return <span className="font-mono text-[14px] tracking-[0.10em] text-ink-3">#{i + 1}</span>
}

export function Leaderboard() {
  const entries = loadLeaderboard()

  return (
    <div className="kr-auth-shell px-4 py-16">
      <div className="relative max-w-3xl mx-auto">
        <Link to="/" className="flex flex-col items-center gap-3 mb-12 no-underline">
          <KickrIQLogo height={28} />
          <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-ink-2">
            Recruiting · Counselor
          </span>
        </Link>

        <header className="text-center mb-14" data-reveal-on-load>
          <span className="kr-eyebrow justify-center">Highlight wall</span>
          <h1 className="kr-h1 mt-4">
            Top <span className="kr-accent">highlight</span> videos.
          </h1>
          <p className="text-[15px] text-ink-1 mt-3 max-w-md mx-auto leading-[1.6]">
            The highest-rated soccer recruitment highlight videos on KickrIQ.
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="kr-panel text-center py-16 px-8">
            <span className="kr-eyebrow justify-center">No entries yet</span>
            <h2 className="kr-h2 mt-4">Be the <span className="kr-accent">first</span>.</h2>
            <p className="text-[14px] text-ink-1 mt-3 mb-7 max-w-sm mx-auto leading-[1.6]">
              Submit your highlight video, get an honest AI rating, and pin yourself to the wall.
            </p>
            <Link
              to="/signup"
              className="kbtn kbtn-primary inline-flex"
            >
              <span className="inline-flex items-center gap-2">
                Get started free
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>
                </svg>
              </span>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className={`p-5 rounded-2xl border flex items-center gap-5 transition-[border-color,background] hover:border-[rgba(240,182,90,0.40)] ${
                  i === 0
                    ? 'bg-[radial-gradient(700px_300px_at_100%_0%,rgba(240,182,90,0.08),transparent_60%),linear-gradient(180deg,rgba(31,27,40,0.92),rgba(24,20,32,0.92))] border-[rgba(240,182,90,0.35)] shadow-[0_0_0_1px_rgba(240,182,90,0.15),0_18px_40px_rgba(0,0,0,0.30)]'
                    : 'bg-[linear-gradient(180deg,rgba(31,27,40,0.82),rgba(24,20,32,0.82))] border-[rgba(245,241,232,0.08)]'
                }`}
              >
                <div className="w-12 flex-shrink-0 flex items-center justify-center">{rankMedal(i)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-0 text-[16px] tracking-[-0.005em]">{entry.athleteName}</div>
                  <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-ink-3 mt-1.5">
                    {entry.position} · {entry.clubTeam} · Class of {entry.gradYear} · {entry.divisionGoal}
                  </div>
                </div>
                <ScoreBadge score={entry.score} />
                <a
                  href={entry.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[12.5px] font-medium border border-[rgba(245,241,232,0.18)] bg-[rgba(245,241,232,0.04)] text-ink-0 hover:bg-[rgba(245,241,232,0.10)] hover:border-[rgba(245,241,232,0.40)] transition-colors no-underline"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>
                  Watch
                </a>
              </div>
            ))}
          </div>
        )}

        <p className="text-center font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-3 mt-14">
          Want your video on the wall?{' '}
          <Link to="/signup" className="text-gold hover:underline underline-offset-4">Start free</Link>
        </p>
      </div>
    </div>
  )
}
