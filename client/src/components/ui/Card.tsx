interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  featured?: boolean
}

export function Card({ children, className = '', hover = false, featured = false }: CardProps) {
  const base =
    'relative overflow-hidden rounded-2xl border ' +
    'bg-[linear-gradient(180deg,rgba(31,27,40,0.92)_0%,rgba(24,20,32,0.92)_100%)] ' +
    "before:content-[''] before:absolute before:inset-0 before:pointer-events-none " +
    'before:bg-[radial-gradient(600px_200px_at_0%_0%,rgba(240,182,90,0.05),transparent_60%)] ' +
    'transition-[transform,border-color,box-shadow] duration-200 ease-out'

  const tone = featured
    ? 'border-[rgba(240,182,90,0.35)] shadow-[0_0_0_1px_rgba(240,182,90,0.18),0_24px_60px_rgba(240,182,90,0.06)]'
    : 'border-[rgba(245,241,232,0.08)]'

  const hoverTone = hover
    ? 'cursor-pointer hover:border-[rgba(245,241,232,0.18)] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35),0_2px_4px_rgba(0,0,0,0.30)]'
    : ''

  return (
    <div className={`${base} ${tone} ${hoverTone} ${className}`}>
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
