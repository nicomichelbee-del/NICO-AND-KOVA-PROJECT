import { useEffect, useState, useCallback } from 'react'
import { Button } from '../ui/Button'
import { useAuth } from '../../context/AuthContext'
import { getCampSummary, getCampComments, rateCamp, postCampComment, deleteCampComment } from '../../lib/api'
import type { CampComment, CampRatingSummary, IdEvent, IdCampEntry, StaffTier } from '../../types'

type CampLike =
  | { kind: 'event'; data: IdEvent }
  | { kind: 'camp'; data: IdCampEntry }

interface Props {
  item: CampLike | null
  onClose: () => void
}

const tierStyle: Record<StaffTier, { label: string; cls: string }> = {
  S: { label: 'S — Tier 1, must-attend',   cls: 'text-[#fbbf24] border-[rgba(251,191,36,0.4)] bg-[rgba(251,191,36,0.08)]' },
  A: { label: 'A — Strong choice',         cls: 'text-[#4ade80] border-[rgba(74,222,128,0.35)] bg-[rgba(74,222,128,0.06)]' },
  B: { label: 'B — Solid',                 cls: 'text-[#60a5fa] border-[rgba(96,165,250,0.35)] bg-[rgba(96,165,250,0.06)]' },
  C: { label: 'C — Niche / regional',      cls: 'text-[#a78bfa] border-[rgba(167,139,250,0.35)] bg-[rgba(167,139,250,0.06)]' },
  D: { label: 'D — Probably skip',         cls: 'text-[#94a3b8] border-[rgba(148,163,184,0.35)] bg-[rgba(148,163,184,0.06)]' },
}

function StarRow({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(n)}
          className={`text-2xl transition-colors ${
            n <= value ? 'text-[#fbbf24]' : 'text-[#475569]'
          } ${onPick ? 'hover:text-[#fbbf24] cursor-pointer' : 'cursor-default'}`}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export function CampDetailModal({ item, onClose }: Props) {
  const { user } = useAuth()
  const [summary, setSummary] = useState<CampRatingSummary | null>(null)
  const [comments, setComments] = useState<CampComment[]>([])
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  const campId = item ? (item.kind === 'event' ? item.data.id : item.data.id) : ''

  const refresh = useCallback(async () => {
    if (!campId) return
    setLoading(true)
    try {
      const [s, c] = await Promise.all([getCampSummary(campId), getCampComments(campId)])
      setSummary(s)
      setComments(c.comments)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [campId])

  useEffect(() => {
    if (!item) return
    setError('')
    setCommentBody('')
    setDisplayName(user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '')
    void refresh()
  }, [item, user, refresh])

  // ESC closes
  useEffect(() => {
    if (!item) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [item, onClose])

  if (!item) return null

  async function handleRate(n: number) {
    if (!user) { setError('Sign in to rate this camp.'); return }
    setError('')
    try {
      await rateCamp(campId, n)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rate')
    }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { setError('Sign in to leave a comment.'); return }
    if (!commentBody.trim()) return
    setPosting(true); setError('')
    try {
      await postCampComment(campId, commentBody.trim(), displayName.trim() || 'Anonymous')
      setCommentBody('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Delete this comment?')) return
    try {
      await deleteCampComment(commentId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  // Display values that differ between event vs single-school camp
  const title = item.kind === 'event' ? item.data.name : item.data.campName
  const subtitle = item.kind === 'event' ? item.data.organizer : item.data.schoolName
  const dateText = item.kind === 'event' ? item.data.dateRange : `Typically: ${item.data.typicalMonths}`
  const location = item.kind === 'event' ? item.data.location : `${item.data.region} region`
  const cost = item.kind === 'event' ? item.data.costRange : item.data.estimatedCost
  const attendance = item.kind === 'event' ? item.data.coachAttendance : item.data.ageRange
  const tier = item.data.staffTier
  const tierReason = item.data.staffTierReason
  const directUrl = item.kind === 'event' ? item.data.url : item.data.registrationUrl
  const fallbackUrl = item.data.searchFallbackUrl
  const lastReviewed = item.data.lastReviewedAt
  const ts = tierStyle[tier]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center px-4 py-10 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1220] border border-[rgba(234,179,8,0.2)] rounded-2xl max-w-2xl w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[rgba(255,255,255,0.05)] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-[#64748b] mb-1">
              {item.kind === 'event' ? 'Showcase Event' : `${item.data.division} ID Camp`}
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#f1f5f9] leading-tight">{title}</h2>
            <div className="text-sm text-[#eab308] mt-1">{subtitle}</div>
          </div>
          <button onClick={onClose} className="text-[#64748b] hover:text-[#f1f5f9] text-2xl leading-none">×</button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Counselor's tier */}
          <div className={`border rounded-lg p-4 ${ts.cls}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1">Counselor's Take</div>
            <div className="font-bold text-base mb-1">{ts.label}</div>
            <p className="text-xs text-[#cbd5e1] leading-relaxed">{tierReason}</p>
          </div>

          {/* Facts */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-[#cbd5e1]">
            <div><span className="text-[#64748b]">📅</span> {dateText}</div>
            <div><span className="text-[#64748b]">📍</span> {location}</div>
            <div><span className="text-[#64748b]">💰</span> {cost}</div>
            <div><span className="text-[#64748b]">👥</span> {attendance}</div>
          </div>

          {/* Notes */}
          <p className="text-sm text-[#cbd5e1] italic leading-relaxed">{item.data.notes}</p>

          {/* Links */}
          <div className="flex flex-col gap-2">
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-[#eab308] text-black font-bold rounded-lg hover:bg-[#f0c010] transition-colors text-sm"
            >
              🔗 Open registration page
            </a>
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#64748b] hover:text-[#cbd5e1] text-center"
            >
              Link broken? Search Google for the latest dates ↗
            </a>
            <div className="text-[10px] text-[#475569] text-center mt-1">
              Last reviewed by counselor: {lastReviewed}
            </div>
          </div>

          {/* User rating section */}
          <div className="border-t border-[rgba(255,255,255,0.05)] pt-5">
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">User Rating</div>
            <div className="flex items-center gap-4 flex-wrap mb-3">
              {summary && summary.ratingCount > 0 ? (
                <>
                  <StarRow value={Math.round(summary.averageRating)} />
                  <span className="text-sm text-[#f1f5f9] font-bold">{summary.averageRating.toFixed(1)}</span>
                  <span className="text-xs text-[#64748b]">({summary.ratingCount} rating{summary.ratingCount !== 1 ? 's' : ''})</span>
                </>
              ) : (
                <span className="text-xs text-[#64748b] italic">No user ratings yet — be the first.</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-[#cbd5e1]">{user ? 'Your rating:' : 'Sign in to rate'}</span>
              <StarRow value={summary?.userRating ?? 0} onPick={user ? handleRate : undefined} />
            </div>
          </div>

          {/* Comments */}
          <div className="border-t border-[rgba(255,255,255,0.05)] pt-5">
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
              {comments.length} Comment{comments.length !== 1 ? 's' : ''}
            </div>

            {user ? (
              <form onSubmit={handlePostComment} className="mb-5 flex flex-col gap-2">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  maxLength={60}
                  className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-xs text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#eab308]"
                />
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Was this camp worth it? Share your honest experience…"
                  rows={3}
                  maxLength={2000}
                  className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#eab308] resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#475569]">{commentBody.length}/2000</span>
                  <Button type="submit" size="sm" disabled={posting || !commentBody.trim()}>
                    {posting ? 'Posting…' : 'Post comment'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mb-5 p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-lg text-xs text-[#64748b] text-center">
                Sign in to leave a comment about this camp.
              </div>
            )}

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            {loading && comments.length === 0 ? (
              <p className="text-xs text-[#64748b] italic">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-[#64748b] italic">No comments yet. Be the first to share.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((c) => (
                  <div key={c.id} className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#f1f5f9]">{c.displayName || 'Anonymous'}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-[#475569]">{timeAgo(c.createdAt)}</span>
                        {user?.id === c.userId && (
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="text-[10px] text-[#64748b] hover:text-red-400"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-[#cbd5e1] whitespace-pre-wrap leading-relaxed">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
