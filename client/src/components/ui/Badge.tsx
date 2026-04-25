interface BadgeProps {
  children: React.ReactNode
  variant?: 'gold' | 'green' | 'muted' | 'blue'
  className?: string
}

const variants = {
  gold: 'bg-[rgba(234,179,8,0.1)] text-[#eab308] border border-[rgba(234,179,8,0.2)]',
  green: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80] border border-[rgba(74,222,128,0.2)]',
  muted: 'bg-[rgba(255,255,255,0.05)] text-[#64748b] border border-[rgba(255,255,255,0.07)]',
  blue: 'bg-[rgba(59,130,246,0.1)] text-[#60a5fa] border border-[rgba(59,130,246,0.2)]',
}

export function Badge({ children, variant = 'gold', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold tracking-wide ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
