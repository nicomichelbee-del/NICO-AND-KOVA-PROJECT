import { useId } from 'react'

interface BeekoLogoProps {
  size?: number
  showText?: boolean
  textClassName?: string
}

export function BeekoLogo({ size = 32, showText = true, textClassName = 'font-serif text-xl font-black text-[#f1f5f9]' }: BeekoLogoProps) {
  const uid = useId().replace(/:/g, '')
  const id = {
    ball: `${uid}ball`,
    shine: `${uid}shine`,
    beeBody: `${uid}beebody`,
    beeHead: `${uid}beehead`,
    wing: `${uid}wing`,
    ballShadow: `${uid}ballshadow`,
    beeGlow: `${uid}beeglow`,
    ballClip: `${uid}ballclip`,
    bodyClip: `${uid}bodyclip`,
  }

  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <radialGradient id={id.ball} cx="32%" cy="28%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#f0f0f0" />
            <stop offset="75%" stopColor="#cccccc" />
            <stop offset="100%" stopColor="#888888" />
          </radialGradient>

          <radialGradient id={id.shine} cx="28%" cy="22%" r="40%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={id.beeBody} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>

          <radialGradient id={id.beeHead} cx="38%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#eab308" />
          </radialGradient>

          <linearGradient id={id.wing} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.2" />
          </linearGradient>

          <filter id={id.ballShadow} x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="2" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.55" />
          </filter>

          <filter id={id.beeGlow} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#fde047" floodOpacity="0.4" />
          </filter>

          <clipPath id={id.ballClip}>
            <circle cx="55" cy="50" r="21" />
          </clipPath>

          <clipPath id={id.bodyClip}>
            <ellipse cx="22" cy="46" rx="9" ry="13" />
          </clipPath>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="55" cy="75" rx="18" ry="4" fill="#000" opacity="0.22" />

        {/* Soccer ball */}
        <circle cx="55" cy="50" r="21" fill={`url(#${id.ball})`} filter={`url(#${id.ballShadow})`} />

        <g clipPath={`url(#${id.ballClip})`}>
          <path d="M55 31 L61 39 L58 48 L52 48 L49 39 Z" fill="#1a1a2e" />
          <path d="M34 43 L40 38 L46 43 L44 51 L36 51 Z" fill="#1a1a2e" opacity="0.85" />
          <path d="M64 38 L70 43 L68 51 L62 51 L61 43 Z" fill="#1a1a2e" opacity="0.85" />
          <path d="M43 57 L49 52 L55 57 L53 65 L45 64 Z" fill="#1a1a2e" opacity="0.8" />
          <path d="M60 57 L58 52 L64 51 L70 57 L67 64 Z" fill="#1a1a2e" opacity="0.8" />
          <path d="M37 62 L38 55 L44 55 L44 62 Z" fill="#1a1a2e" opacity="0.6" />
          <path d="M55 29 Q60 37 58 47" stroke="#6b7280" strokeWidth="0.5" fill="none" opacity="0.5" />
          <path d="M34 42 Q43 37 49 38" stroke="#6b7280" strokeWidth="0.5" fill="none" opacity="0.5" />
          <path d="M64 37 Q65 45 62 50" stroke="#6b7280" strokeWidth="0.5" fill="none" opacity="0.5" />
        </g>

        <circle cx="55" cy="50" r="21" fill={`url(#${id.shine})`} />

        {/* Wings */}
        <ellipse cx="14" cy="23" rx="14" ry="7" fill={`url(#${id.wing})`} transform="rotate(-35 14 23)" />
        <ellipse cx="12" cy="32" rx="10" ry="5" fill={`url(#${id.wing})`} transform="rotate(-20 12 32)" opacity="0.75" />
        <ellipse cx="32" cy="19" rx="12" ry="5.5" fill={`url(#${id.wing})`} transform="rotate(-50 32 19)" />
        <ellipse cx="34" cy="27" rx="9" ry="4" fill={`url(#${id.wing})`} transform="rotate(-30 34 27)" opacity="0.7" />

        {/* Bee body */}
        <ellipse cx="22" cy="46" rx="9" ry="13" fill={`url(#${id.beeBody})`} filter={`url(#${id.beeGlow})`} />
        <rect x="13" y="41" width="18" height="4" rx="2" fill="#1a1a2e" clipPath={`url(#${id.bodyClip})`} opacity="0.9" />
        <rect x="13" y="48" width="18" height="4" rx="2" fill="#1a1a2e" clipPath={`url(#${id.bodyClip})`} opacity="0.9" />
        <ellipse cx="19" cy="40" rx="4" ry="3" fill="#fde047" opacity="0.5" />

        {/* Stinger */}
        <path d="M22 59 L19 67 L25 67 Z" fill="#ca8a04" />
        <path d="M22 59 L20 64 L22 65 L24 64 Z" fill="#92400e" opacity="0.6" />

        {/* Kicking leg */}
        <path d="M28 50 Q36 52 40 55" stroke="#eab308" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M28 50 Q36 52 40 55" stroke="#ca8a04" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />
        <path d="M40 55 Q44 58 45 60" stroke="#eab308" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <ellipse cx="46" cy="61" rx="5" ry="3.5" fill="#1a1a2e" transform="rotate(-20 46 61)" />
        <ellipse cx="46" cy="61" rx="3.5" ry="2" fill="#374151" transform="rotate(-20 46 61)" />

        {/* Standing leg */}
        <path d="M20 58 Q16 65 18 70" stroke="#eab308" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M18 70 Q17 73 20 74" stroke="#eab308" strokeWidth="3.5" strokeLinecap="round" fill="none" />

        {/* Bee head */}
        <circle cx="23" cy="26" r="11" fill={`url(#${id.beeHead})`} filter={`url(#${id.beeGlow})`} />
        <ellipse cx="20" cy="22" rx="5" ry="4" fill="#fde047" opacity="0.45" />

        {/* Angry face */}
        <path d="M16 20 L22 23" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M24 22 L30 19" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="19" cy="25.5" rx="2.5" ry="2" fill="#1a1a2e" />
        <ellipse cx="27" cy="24" rx="2.5" ry="2" fill="#1a1a2e" />
        <circle cx="18.2" cy="24.8" r="0.8" fill="white" opacity="0.9" />
        <circle cx="26.2" cy="23.3" r="0.8" fill="white" opacity="0.9" />
        <path d="M17 30 Q20 33 27 31" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" fill="none" />
        <rect x="18" y="30" width="8" height="3" rx="0.5" fill="#1a1a2e" opacity="0.15" />
        <line x1="20" y1="30" x2="20" y2="32.5" stroke="#1a1a2e" strokeWidth="0.8" opacity="0.5" />
        <line x1="22.5" y1="30.5" x2="22.5" y2="33" stroke="#1a1a2e" strokeWidth="0.8" opacity="0.5" />
        <line x1="25" y1="30" x2="25" y2="32" stroke="#1a1a2e" strokeWidth="0.8" opacity="0.5" />

        {/* Antennae */}
        <path d="M19 16 Q15 9 11 5" stroke="#eab308" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="11" cy="5" r="2.5" fill="#eab308" />
        <circle cx="11" cy="5" r="1.2" fill="#fde047" />
        <path d="M27 15 Q29 8 31 4" stroke="#eab308" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="31" cy="4" r="2.5" fill="#eab308" />
        <circle cx="31" cy="4" r="1.2" fill="#fde047" />

        {/* Speed lines */}
        <line x1="71" y1="36" x2="78" y2="31" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="73" y1="44" x2="80" y2="42" stroke="#eab308" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        <line x1="71" y1="53" x2="79" y2="56" stroke="#eab308" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      </svg>

      {showText && (
        <span className={textClassName} style={{ letterSpacing: '-0.02em' }}>
          Beeko
        </span>
      )}
    </div>
  )
}
