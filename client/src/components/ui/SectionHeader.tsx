/**
 * Smaller editorial header for in-page sections (h2-level).
 */
interface Props {
  eyebrow?: string
  title: React.ReactNode
  aside?: React.ReactNode
  className?: string
}

export function SectionHeader({ eyebrow, title, aside, className = '' }: Props) {
  return (
    <div className={`flex items-end justify-between mb-5 gap-4 flex-wrap ${className}`}>
      <div className="min-w-0">
        {eyebrow && <span className="kr-eyebrow">{eyebrow}</span>}
        <h2 className="kr-h2 mt-2">{title}</h2>
      </div>
      {aside && <div className="shrink-0 flex items-center gap-2 flex-wrap">{aside}</div>}
    </div>
  )
}
