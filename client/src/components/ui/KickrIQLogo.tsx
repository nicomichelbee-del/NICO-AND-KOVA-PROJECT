/**
 * KickrIQ wordmark — Saira Condensed Black Italic with the "iQ" set in gold.
 * Sized via the --logo-h CSS var (height in px). The CSS lives in styles/kickriq.css.
 */
import type { CSSProperties } from 'react'

interface Props {
  height?: number
  className?: string
}

export function KickrIQLogo({ height = 32, className = '' }: Props) {
  return (
    <span
      className={`kickriq-logo ${className}`}
      style={{ ['--logo-h' as string]: `${height}px` } as CSSProperties}
      aria-label="KickrIQ"
      role="img"
    >
      <span className="klogo-kickr">Kickr</span>
      <span className="klogo-iq">
        <span className="klogo-i">i</span>
        <span className="klogo-q">Q</span>
      </span>
    </span>
  )
}
