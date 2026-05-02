import { useState, useRef, useEffect } from 'react'
import { chatWithBeeko } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { BeekoLogo } from '../../components/ui/BeekoLogo'
import type { AthleteProfile } from '../../types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const STORAGE_KEY = 'beeko_chat_history'

const STARTERS = [
  { q: 'When should I start emailing D1 coaches?', emoji: '📅' },
  { q: 'How many schools should I be targeting?', emoji: '🎯' },
  { q: 'What stats do D1 coaches care about most?', emoji: '📊' },
  { q: 'How do I stand out at ID camps?', emoji: '⛺' },
  { q: "What's the difference between D1, D2, and D3 recruiting?", emoji: '🏟️' },
  { q: 'How important is club soccer vs high school soccer?', emoji: '⚽' },
]

function getProfile(): AthleteProfile | null {
  try { return JSON.parse(localStorage.getItem('athleteProfile') ?? '') } catch { return null }
}

function loadMessages(): Message[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 h-5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 rounded-full bg-[#64748b] animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

export function Chat() {
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setError('')
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed, timestamp: Date.now() }
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
        { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: Date.now() },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function clearChat() {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
    inputRef.current?.focus()
  }

  const profile = getProfile()

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Header */}
      <div className="px-8 py-5 border-b border-[rgba(255,255,255,0.07)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <BeekoLogo size={32} showText={false} />
          <div>
            <div className="text-sm font-bold text-[#f1f5f9]">Beeko Chat</div>
            <div className="text-xs text-[#64748b]">
              {profile ? `Advising ${profile.name} · ${profile.targetDivision} · Class of ${profile.gradYear}` : '15+ years of D1–NAIA recruiting expertise'}
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-[#475569] hover:text-[#94a3b8] transition-colors px-3 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.04)]"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-5 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center gap-8 py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.15)] flex items-center justify-center">
                <BeekoLogo size={52} showText={false} />
              </div>
              <div>
                <div className="font-serif text-2xl font-black text-[#f1f5f9] mb-1.5">Ask me anything</div>
                <div className="text-sm text-[#64748b] max-w-xs">
                  D1 timelines · email strategy · ID camp prep · what coaches actually look for
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {STARTERS.map(({ q, emoji }) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="flex items-start gap-2.5 text-left text-xs px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.07)] text-[#64748b] hover:border-[rgba(234,179,8,0.3)] hover:text-[#f1f5f9] hover:bg-[rgba(234,179,8,0.03)] transition-all"
                >
                  <span className="text-base shrink-0 mt-0.5">{emoji}</span>
                  <span className="leading-relaxed">{q}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' && (
                  <div className="shrink-0 w-8 h-8 rounded-xl bg-[rgba(234,179,8,0.1)] border border-[rgba(234,179,8,0.2)] flex items-center justify-center mt-0.5">
                    <BeekoLogo size={22} showText={false} />
                  </div>
                )}
                <div
                  className={`max-w-[72%] text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#eab308] text-black font-medium px-4 py-3 rounded-2xl rounded-tr-sm'
                      : 'bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] text-[#e2e8f0] px-4 py-3 rounded-2xl rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-xl bg-[rgba(234,179,8,0.1)] border border-[rgba(234,179,8,0.2)] flex items-center justify-center mt-0.5">
                  <BeekoLogo size={22} showText={false} />
                </div>
                <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.07)] px-4 py-3 rounded-2xl rounded-tl-sm">
                  <ThinkingDots />
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 text-center py-2">{error}</div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-8 py-4 border-t border-[rgba(255,255,255,0.07)] bg-[rgba(7,9,15,0.8)] shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input) }}
          className="flex gap-3 items-center"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Beeko about the recruiting process..."
            disabled={loading}
            className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.09)] rounded-xl px-4 py-3 text-sm text-[#f1f5f9] placeholder-[#475569] outline-none focus:border-[rgba(234,179,8,0.35)] focus:bg-[rgba(234,179,8,0.02)] transition-all disabled:opacity-50"
          />
          <Button type="submit" size="md" disabled={loading || !input.trim()}>
            Send →
          </Button>
        </form>
      </div>
    </div>
  )
}
