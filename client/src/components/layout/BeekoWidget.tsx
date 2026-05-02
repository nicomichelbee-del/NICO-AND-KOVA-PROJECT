import { useState, useRef, useEffect } from 'react'
import { chatWithBeeko } from '../../lib/api'
import { BeekoLogo } from '../ui/BeekoLogo'
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

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

function loadMessages(): Message[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 h-4">
      {[0, 150, 300].map((d) => (
        <span key={d} className="w-1.5 h-1.5 rounded-full bg-[#64748b] animate-bounce" style={{ animationDelay: `${d}ms` }} />
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
        className={`flex flex-col w-[360px] bg-[#0c1118] border border-[rgba(255,255,255,0.09)] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 origin-bottom-right ${
          open ? 'opacity-100 scale-100 h-[520px]' : 'opacity-0 scale-95 h-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.07)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[rgba(234,179,8,0.12)] border border-[rgba(234,179,8,0.2)] flex items-center justify-center">
              <BeekoLogo size={18} showText={false} />
            </div>
            <div>
              <div className="text-sm font-bold text-[#f1f5f9] leading-none mb-0.5">Ask Beeko</div>
              <div className="text-[10px] text-[#64748b]">15+ yrs recruiting expertise</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); localStorage.removeItem(STORAGE_KEY) }}
                className="text-[10px] text-[#475569] hover:text-[#94a3b8] px-2 py-1 rounded transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#475569] hover:text-[#f1f5f9] hover:bg-[rgba(255,255,255,0.06)] transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3 pt-2">
              <div className="text-xs text-[#64748b] text-center pb-1">What do you want to know?</div>
              {STARTERS.map(({ q, emoji }) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="flex items-start gap-2 text-left text-xs px-3 py-2.5 rounded-xl border border-[rgba(255,255,255,0.07)] text-[#64748b] hover:border-[rgba(234,179,8,0.3)] hover:text-[#f1f5f9] hover:bg-[rgba(234,179,8,0.03)] transition-all"
                >
                  <span className="shrink-0 mt-0.5">{emoji}</span>
                  <span className="leading-relaxed">{q}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'assistant' && (
                    <div className="shrink-0 w-6 h-6 rounded-lg bg-[rgba(234,179,8,0.1)] border border-[rgba(234,179,8,0.2)] flex items-center justify-center mt-0.5">
                      <BeekoLogo size={16} showText={false} />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#eab308] text-black font-medium px-3 py-2 rounded-xl rounded-tr-sm'
                        : 'bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] text-[#e2e8f0] px-3 py-2 rounded-xl rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="shrink-0 w-6 h-6 rounded-lg bg-[rgba(234,179,8,0.1)] border border-[rgba(234,179,8,0.2)] flex items-center justify-center mt-0.5">
                    <BeekoLogo size={16} showText={false} />
                  </div>
                  <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] px-3 py-2 rounded-xl rounded-tl-sm">
                    <ThinkingDots />
                  </div>
                </div>
              )}

              {error && <div className="text-[10px] text-red-400 text-center">{error}</div>}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.07)] shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about recruiting..."
              disabled={loading}
              className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.09)] rounded-xl px-3 py-2 text-xs text-[#f1f5f9] placeholder-[#475569] outline-none focus:border-[rgba(234,179,8,0.35)] transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-xl bg-[#eab308] text-black text-xs font-bold hover:bg-[#f0c010] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              →
            </button>
          </form>
        </div>
      </div>

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-[#eab308] hover:bg-[#f0c010] shadow-lg hover:shadow-[0_0_24px_rgba(234,179,8,0.35)] flex items-center justify-center transition-all active:scale-95 relative"
      >
        <BeekoLogo size={30} showText={false} />
        {unread && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-[#4ade80] border-2 border-[#07090f]" />
        )}
      </button>
    </div>
  )
}
