import { useState, useRef, useEffect } from 'react'
import { chatWithBeeko } from '../../lib/api'
import type { AthleteProfile } from '../../types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'beeko_chat_history'

const STARTERS = [
  { q: 'When should I start emailing D1 coaches?', emoji: '📅' },
  { q: 'How many schools should I target?', emoji: '🎯' },
  { q: 'What stats do D1 coaches care most about?', emoji: '📊' },
  { q: 'How do I stand out at ID camps?', emoji: '⛺' },
]

const SUPPORT_PHONE_DISPLAY = '(415) 619-9477'
const SUPPORT_PHONE_TEL = '+14156199477'
const SUPPORT_EMAIL = 'infokickriq@gmail.com'

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

function loadMessages(): Message[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 h-4">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="w-1.5 h-1.5 rounded-full bg-gold/70 animate-bounce"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  )
}

export function BeekoWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(loadMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60)))
  }, [messages])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, messages, loading])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setError('')
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const profile = getProfile()
      const { reply } = await chatWithBeeko(
        next.map((m) => ({ role: m.role, content: m.content })),
        profile ?? undefined,
      )
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const unread = !open && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant'

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      <div
        className={`flex flex-col w-[360px] bg-[linear-gradient(180deg,rgba(31,27,40,0.96)_0%,rgba(20,16,26,0.98)_100%)] backdrop-blur-md border border-[rgba(245,241,232,0.10)] rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(240,182,90,0.10)] overflow-hidden transition-[opacity,transform,height] duration-300 origin-bottom-right ${
          open ? 'opacity-100 scale-100 h-[520px]' : 'opacity-0 scale-95 h-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(245,241,232,0.08)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[rgba(240,182,90,0.12)] border border-[rgba(240,182,90,0.30)] flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_6px_var(--gold)] animate-pulse" />
            </div>
            <div>
              <div className="font-serif text-[15px] text-ink-0 leading-none mb-1" style={{ letterSpacing: '-0.015em' }}>
                Ask the <span className="kr-accent">counselor</span>
              </div>
              <div className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-ink-3">15+ yrs recruiting</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); localStorage.removeItem(STORAGE_KEY) }}
                className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-ink-3 hover:text-ink-1 px-2 py-1 rounded transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="w-7 h-7 flex items-center justify-center rounded-full text-ink-2 hover:text-ink-0 hover:bg-[rgba(245,241,232,0.06)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="font-mono text-[10px] tracking-[0.20em] uppercase text-ink-3 text-center pb-1">
                Try one of these
              </div>
              {STARTERS.map(({ q }) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left text-[13px] px-3.5 py-2.5 rounded-xl border border-[rgba(245,241,232,0.08)] bg-[rgba(245,241,232,0.02)] text-ink-1 hover:border-[rgba(240,182,90,0.40)] hover:text-ink-0 hover:bg-[rgba(240,182,90,0.04)] transition-[border-color,background,color] leading-[1.45]"
                >
                  {q}
                </button>
              ))}

              <div className="mt-4 pt-4 border-t border-[rgba(245,241,232,0.06)]">
                <div className="font-mono text-[10px] tracking-[0.20em] uppercase text-ink-3 text-center pb-2.5">
                  Contact us directly
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href={`tel:${SUPPORT_PHONE_TEL}`}
                    className="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[rgba(240,182,90,0.18)] bg-[rgba(240,182,90,0.04)] text-ink-1 hover:border-[rgba(240,182,90,0.50)] hover:bg-[rgba(240,182,90,0.08)] hover:text-ink-0 transition-[border-color,background,color]"
                  >
                    <span className="shrink-0 w-7 h-7 rounded-full bg-[rgba(240,182,90,0.12)] border border-[rgba(240,182,90,0.30)] flex items-center justify-center text-gold">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-ink-3 leading-none mb-1">Call</div>
                      <div className="text-[13px] font-medium leading-none">{SUPPORT_PHONE_DISPLAY}</div>
                    </div>
                  </a>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[rgba(240,182,90,0.18)] bg-[rgba(240,182,90,0.04)] text-ink-1 hover:border-[rgba(240,182,90,0.50)] hover:bg-[rgba(240,182,90,0.08)] hover:text-ink-0 transition-[border-color,background,color]"
                  >
                    <span className="shrink-0 w-7 h-7 rounded-full bg-[rgba(240,182,90,0.12)] border border-[rgba(240,182,90,0.30)] flex items-center justify-center text-gold">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <path d="M22 6l-10 7L2 6"/>
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-ink-3 leading-none mb-1">Email</div>
                      <div className="text-[13px] font-medium leading-none truncate">{SUPPORT_EMAIL}</div>
                    </div>
                  </a>
                </div>
                <div className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-3 text-center pt-2.5 leading-relaxed">
                  Mon–Fri · 9am–6pm PT
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 w-6 h-6 rounded-full bg-[rgba(240,182,90,0.12)] border border-[rgba(240,182,90,0.30)] flex items-center justify-center mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_5px_var(--gold)]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] text-[13px] leading-[1.55] whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[linear-gradient(180deg,#f5c170_0%,#e0982e_100%)] text-[#1a1304] font-medium px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-[0_4px_12px_rgba(240,182,90,0.20)]'
                        : 'bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.08)] text-ink-1 px-3.5 py-2.5 rounded-2xl rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-[rgba(240,182,90,0.12)] border border-[rgba(240,182,90,0.30)] flex items-center justify-center mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_5px_var(--gold)] animate-pulse" />
                  </div>
                  <div className="bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.08)] px-3.5 py-2.5 rounded-2xl rounded-tl-sm">
                    <ThinkingDots />
                  </div>
                </div>
              )}

              {error && (
                <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-crimson-light text-center">
                  {error}
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Contact strip — always reachable */}
        {messages.length > 0 && (
          <div className="px-4 pt-2 pb-2.5 border-t border-[rgba(245,241,232,0.08)] shrink-0">
            <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-3 text-center mb-1.5">
              Contact us
            </div>
            <div className="flex items-center justify-center gap-3">
              <a
                href={`tel:${SUPPORT_PHONE_TEL}`}
                className="inline-flex items-center gap-1.5 text-[11px] text-ink-1 hover:text-gold transition-colors"
                aria-label={`Call ${SUPPORT_PHONE_DISPLAY}`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold/70">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {SUPPORT_PHONE_DISPLAY}
              </a>
              <span className="w-px h-3 bg-[rgba(245,241,232,0.14)]" aria-hidden="true" />
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-1.5 text-[11px] text-ink-1 hover:text-gold transition-colors max-w-[180px]"
                aria-label={`Email ${SUPPORT_EMAIL}`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold/70 shrink-0">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <path d="M22 6l-10 7L2 6"/>
                </svg>
                <span className="truncate">{SUPPORT_EMAIL}</span>
              </a>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-[rgba(245,241,232,0.08)] shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about recruiting…"
              disabled={loading}
              className="flex-1 bg-[rgba(245,241,232,0.03)] border border-[rgba(245,241,232,0.10)] rounded-full px-4 py-2.5 text-[13px] text-ink-0 placeholder-ink-3 caret-gold outline-none focus:border-[rgba(240,182,90,0.55)] focus:ring-[3px] focus:ring-[rgba(240,182,90,0.18)] focus:bg-[rgba(245,241,232,0.05)] transition-[border-color,background,box-shadow] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-full bg-[linear-gradient(180deg,#f5c170_0%,#e0982e_100%)] text-[#1a1304] hover:bg-[linear-gradient(180deg,#ffd28a_0%,#e8a23a_100%)] hover:shadow-[0_0_0_4px_rgba(240,182,90,0.18)] transition-[box-shadow,background,transform] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close counselor chat' : 'Open counselor chat'}
        className="group relative w-14 h-14 rounded-full bg-[linear-gradient(180deg,#f5c170_0%,#e0982e_100%)] hover:bg-[linear-gradient(180deg,#ffd28a_0%,#e8a23a_100%)] shadow-[0_8px_22px_rgba(240,182,90,0.25)] hover:shadow-[0_0_0_8px_rgba(240,182,90,0.16),0_0_32px_rgba(240,182,90,0.55),0_22px_50px_rgba(240,182,90,0.40)] hover:-translate-y-[2px] hover:scale-[1.04] flex items-center justify-center transition-[transform,box-shadow,background] duration-200 active:scale-95"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1304" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unread && (
          <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-pitch-light border-2 border-navy shadow-[0_0_8px_var(--pitch-2)]" />
        )}
      </button>
    </div>
  )
}
