interface BadgeProps {
  children: React.ReactNode
  variant?: 'gold' | 'green' | 'muted' | 'blue' | 'crimson'
  className?: string
}

const variants = {
  gold: 'text-gold bg-[rgba(240,182,90,0.10)] border-[rgba(240,182,90,0.30)]',
  green: 'text-pitch-light bg-[rgba(78,163,110,0.10)] border-[rgba(78,163,110,0.28)]',
  muted: 'text-ink-2 bg-[rgba(245,241,232,0.04)] border-[rgba(245,241,232,0.10)]',
  blue: 'text-[#7ab9ff] bg-[rgba(122,185,255,0.10)] border-[rgba(122,185,255,0.25)]',
  crimson: 'text-crimson-light bg-[rgba(227,90,90,0.10)] border-[rgba(227,90,90,0.28)]',
}

export function Badge({ children, variant = 'gold', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10.5px] font-medium tracking-[0.16em] uppercase border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
