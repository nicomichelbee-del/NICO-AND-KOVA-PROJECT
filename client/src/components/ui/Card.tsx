interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`bg-[rgba(255,255,255,0.03)] border border-[rgba(234,179,8,0.15)] rounded-2xl ${hover ? 'transition-all hover:border-[rgba(234,179,8,0.3)] hover:bg-[rgba(234,179,8,0.04)] cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
