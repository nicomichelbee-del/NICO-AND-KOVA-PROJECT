/**
 * Editorial page header used across the dashboard.
 *  - eyebrow: small mono-uppercase line with gold dot prefix
 *  - title: serif Fraunces headline; pass JSX to highlight a word with `.kr-accent`
 *  - lede:   optional supporting paragraph
 *  - aside:  optional right-side slot (badges, action buttons, status)
 */
interface Props {
  eyebrow?: string
  title: React.ReactNode
  lede?: React.ReactNode
  aside?: React.ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, lede, aside, className = '' }: Props) {
  return (
    <header
      className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-10 ${className}`}
      data-reveal-on-load
    >
      <div className="min-w-0 flex-1">
        {eyebrow && <span className="kr-eyebrow">{eyebrow}</span>}
        <h1 className="kr-h1 mt-3">{title}</h1>
        {lede && (
          <p className="text-[15px] text-ink-1 mt-3 max-w-[58ch] leading-[1.6]">{lede}</p>
        )}
      </div>
      {aside && <div className="shrink-0 flex items-center gap-3 flex-wrap">{aside}</div>}
    </header>
  )
}
