import { useEffect, useMemo, useState } from 'react'
import { ALL_POSITION_LABELS } from '../../types/profile'

type Slot = { code: string; x: number; y: number }

// Vertical pitch, 100×140 viewBox, attack faces up.
// Each formation defines exactly 11 slots. Side-aware codes (LCB/RCB, LWB/RWB,
// LCM/RCM, LDM/RDM, LST/RST) are used so coaches can read the player's role.
const FORMATIONS: Record<string, Slot[]> = {
  '4-3-3': [
    { code: 'ST',  x: 50, y: 22 },
    { code: 'LW',  x: 18, y: 30 },
    { code: 'RW',  x: 82, y: 30 },
    { code: 'LCM', x: 32, y: 58 },
    { code: 'CM',  x: 50, y: 50 },
    { code: 'RCM', x: 68, y: 58 },
    { code: 'LB',  x: 12, y: 100 },
    { code: 'LCB', x: 36, y: 106 },
    { code: 'RCB', x: 64, y: 106 },
    { code: 'RB',  x: 88, y: 100 },
    { code: 'GK',  x: 50, y: 128 },
  ],
  '4-4-2': [
    { code: 'LST', x: 38, y: 22 },
    { code: 'RST', x: 62, y: 22 },
    { code: 'LM',  x: 12, y: 58 },
    { code: 'LCM', x: 36, y: 60 },
    { code: 'RCM', x: 64, y: 60 },
    { code: 'RM',  x: 88, y: 58 },
    { code: 'LB',  x: 12, y: 100 },
    { code: 'LCB', x: 36, y: 106 },
    { code: 'RCB', x: 64, y: 106 },
    { code: 'RB',  x: 88, y: 100 },
    { code: 'GK',  x: 50, y: 128 },
  ],
  '4-2-3-1': [
    { code: 'ST',  x: 50, y: 22 },
    { code: 'LW',  x: 18, y: 40 },
    { code: 'AM',  x: 50, y: 46 },
    { code: 'RW',  x: 82, y: 40 },
    { code: 'LDM', x: 34, y: 72 },
    { code: 'RDM', x: 66, y: 72 },
    { code: 'LB',  x: 12, y: 100 },
    { code: 'LCB', x: 36, y: 106 },
    { code: 'RCB', x: 64, y: 106 },
    { code: 'RB',  x: 88, y: 100 },
    { code: 'GK',  x: 50, y: 128 },
  ],
  '3-5-2': [
    { code: 'LST', x: 38, y: 22 },
    { code: 'RST', x: 62, y: 22 },
    { code: 'AM',  x: 50, y: 50 },
    { code: 'LWB', x: 10, y: 68 },
    { code: 'LCM', x: 32, y: 70 },
    { code: 'RCM', x: 68, y: 70 },
    { code: 'RWB', x: 90, y: 68 },
    { code: 'LCB', x: 26, y: 104 },
    { code: 'CCB', x: 50, y: 108 },
    { code: 'RCB', x: 74, y: 104 },
    { code: 'GK',  x: 50, y: 128 },
  ],
  '3-4-3': [
    { code: 'LW',  x: 18, y: 26 },
    { code: 'ST',  x: 50, y: 22 },
    { code: 'RW',  x: 82, y: 26 },
    { code: 'LCM', x: 36, y: 60 },
    { code: 'RCM', x: 64, y: 60 },
    { code: 'LWB', x: 10, y: 84 },
    { code: 'RWB', x: 90, y: 84 },
    { code: 'LCB', x: 26, y: 104 },
    { code: 'CCB', x: 50, y: 108 },
    { code: 'RCB', x: 74, y: 104 },
    { code: 'GK',  x: 50, y: 128 },
  ],
  '5-3-2': [
    { code: 'LST', x: 38, y: 24 },
    { code: 'RST', x: 62, y: 24 },
    { code: 'LCM', x: 30, y: 58 },
    { code: 'CM',  x: 50, y: 58 },
    { code: 'RCM', x: 70, y: 58 },
    { code: 'LWB', x: 8,  y: 92 },
    { code: 'LCB', x: 28, y: 104 },
    { code: 'CCB', x: 50, y: 108 },
    { code: 'RCB', x: 72, y: 104 },
    { code: 'RWB', x: 92, y: 92 },
    { code: 'GK',  x: 50, y: 128 },
  ],
}

const FORMATION_ORDER = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2'] as const
type FormationKey = (typeof FORMATION_ORDER)[number]

const FORMATION_STORAGE_KEY = 'kickriq.pitchFormation'

function findFormationContaining(code: string | null): FormationKey | null {
  if (!code) return null
  for (const key of FORMATION_ORDER) {
    if (FORMATIONS[key].some((p) => p.code === code)) return key
  }
  return null
}

function loadStoredFormation(): FormationKey | null {
  try {
    const v = localStorage.getItem(FORMATION_STORAGE_KEY)
    if (v && (FORMATION_ORDER as readonly string[]).includes(v)) return v as FormationKey
  } catch {}
  return null
}

type Mode = 'primary' | 'secondary'

interface Props {
  primary: string | null
  secondary: string | null
  onPickPrimary: (code: string) => void
  onPickSecondary: (code: string | null) => void
}

export function PitchPositionPicker({ primary, secondary, onPickPrimary, onPickSecondary }: Props) {
  const [mode, setMode] = useState<Mode>('primary')
  const [formation, setFormation] = useState<FormationKey>(
    () => findFormationContaining(primary) ?? loadStoredFormation() ?? '4-3-3',
  )

  // Persist formation choice across sessions.
  useEffect(() => {
    try { localStorage.setItem(FORMATION_STORAGE_KEY, formation) } catch {}
  }, [formation])

  const slots = FORMATIONS[formation]

  // If the saved primary/secondary code isn't on the current formation's pitch,
  // surface a small badge so the user knows what they previously picked.
  const orphanPrimary = useMemo(
    () => (primary && !slots.some((s) => s.code === primary) ? primary : null),
    [primary, slots],
  )
  const orphanSecondary = useMemo(
    () => (secondary && !slots.some((s) => s.code === secondary) ? secondary : null),
    [secondary, slots],
  )

  function handlePick(code: string) {
    if (mode === 'primary') {
      if (secondary === code) onPickSecondary(null)
      onPickPrimary(code)
    } else {
      if (secondary === code) {
        onPickSecondary(null)
        return
      }
      if (primary === code) return
      onPickSecondary(code)
    }
  }

  function jumpToFormationFor(code: string) {
    const f = findFormationContaining(code)
    if (f) setFormation(f)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[rgba(245,241,232,0.04)] border border-[rgba(245,241,232,0.08)]">
        <ModeTab active={mode === 'primary'} onClick={() => setMode('primary')}>
          Primary
          {primary && <span className="ml-2 text-gold/80">{primary}</span>}
        </ModeTab>
        <ModeTab active={mode === 'secondary'} onClick={() => setMode('secondary')}>
          Secondary
          {secondary
            ? <span className="ml-2 text-ink-1/80">{secondary}</span>
            : <span className="ml-2 text-ink-3 text-[10px] tracking-[0.18em] uppercase font-mono">opt.</span>}
        </ModeTab>
      </div>

      {/* Formation switcher */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-3">Formation</span>
          {(orphanPrimary || orphanSecondary) && (
            <button
              type="button"
              onClick={() => jumpToFormationFor((orphanPrimary ?? orphanSecondary)!)}
              className="font-mono text-[10px] tracking-[0.10em] uppercase text-gold/80 hover:text-gold transition-colors"
            >
              Jump to {orphanPrimary ?? orphanSecondary}
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-hide">
          {FORMATION_ORDER.map((f) => {
            const active = formation === f
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFormation(f)}
                className={`shrink-0 px-3 py-1.5 rounded-full font-mono text-[11px] tracking-[0.10em] font-semibold transition-[background,color,box-shadow] duration-150 ${
                  active
                    ? 'bg-[rgba(240,182,90,0.12)] text-gold shadow-[0_0_0_1px_rgba(240,182,90,0.45)]'
                    : 'bg-[rgba(245,241,232,0.04)] text-ink-2 border border-[rgba(245,241,232,0.10)] hover:text-ink-0 hover:border-[rgba(240,182,90,0.30)]'
                }`}
              >
                {f}
              </button>
            )
          })}
        </div>
      </div>

      {/* Pitch */}
      <div
        className="relative w-full max-w-[360px] mx-auto rounded-2xl overflow-hidden border border-[rgba(245,241,232,0.10)] bg-[linear-gradient(180deg,rgba(47,125,79,0.14)_0%,rgba(47,125,79,0.06)_50%,rgba(47,125,79,0.14)_100%)] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
        style={{ aspectRatio: '100 / 140' }}
      >
        <PitchSvg />

        {slots.map(({ code, x, y }) => {
          const isPrimary = primary === code
          const isSecondary = secondary === code
          const disabled = mode === 'secondary' && primary === code
          const label = ALL_POSITION_LABELS[code] ?? code
          return (
            <button
              key={code}
              type="button"
              onClick={() => handlePick(code)}
              disabled={disabled}
              aria-label={`${label} — ${isPrimary ? 'primary' : isSecondary ? 'secondary' : 'tap to select'}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-[transform] duration-150 ${
                disabled ? 'cursor-not-allowed opacity-40' : 'hover:scale-110 active:scale-95'
              }`}
              style={{ left: `${x}%`, top: `${(y / 140) * 100}%` }}
            >
              <Dot code={code} isPrimary={isPrimary} isSecondary={isSecondary} />
            </button>
          )
        })}
      </div>

      <p className="text-center font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-3">
        {mode === 'primary'
          ? 'Tap your main position'
          : secondary
            ? 'Tap again to clear'
            : 'Tap a backup position (optional)'}
      </p>
    </div>
  )
}

function Dot({ code, isPrimary, isSecondary }: { code: string; isPrimary: boolean; isSecondary: boolean }) {
  const base = 'w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold tracking-tight transition-[background,box-shadow,border-color] duration-150'
  if (isPrimary) {
    return (
      <span
        className={`${base} text-[#1a1304] bg-[linear-gradient(180deg,#f5c170_0%,#e0982e_100%)] border border-[rgba(255,255,255,0.20)] shadow-[0_0_0_3px_rgba(240,182,90,0.12),0_0_12px_rgba(240,182,90,0.30)]`}
      >
        {code}
      </span>
    )
  }
  if (isSecondary) {
    return (
      <span
        className={`${base} text-gold bg-[rgba(240,182,90,0.10)] border border-[rgba(240,182,90,0.55)] shadow-[0_0_0_2px_rgba(240,182,90,0.08)]`}
      >
        {code}
      </span>
    )
  }
  return (
    <span
      className={`${base} text-ink-1 bg-[rgba(19,16,23,0.65)] border border-[rgba(245,241,232,0.20)] backdrop-blur-sm hover:border-[rgba(240,182,90,0.55)] hover:text-gold`}
    >
      {code}
    </span>
  )
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-full text-[12px] font-medium tracking-tight transition-[background,color] duration-150 ${
        active
          ? 'bg-[rgba(240,182,90,0.10)] text-ink-0 shadow-[0_0_0_1px_rgba(240,182,90,0.40)]'
          : 'text-ink-2 hover:text-ink-0'
      }`}
    >
      {children}
    </button>
  )
}

function PitchSvg() {
  const lineColor = 'rgba(245,241,232,0.22)'
  const lineThin = 'rgba(245,241,232,0.14)'
  return (
    <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      {Array.from({ length: 7 }).map((_, i) => (
        <rect
          key={i}
          x={0}
          y={i * 20}
          width={100}
          height={20}
          fill={i % 2 === 0 ? 'rgba(78,163,110,0.05)' : 'rgba(78,163,110,0.10)'}
        />
      ))}

      <rect x={5} y={5} width={90} height={130} fill="none" stroke={lineColor} strokeWidth={0.6} />
      <line x1={5} y1={70} x2={95} y2={70} stroke={lineColor} strokeWidth={0.4} />
      <circle cx={50} cy={70} r={9} fill="none" stroke={lineColor} strokeWidth={0.4} />
      <circle cx={50} cy={70} r={0.8} fill={lineColor} />

      <rect x={26} y={5} width={48} height={18} fill="none" stroke={lineThin} strokeWidth={0.4} />
      <rect x={38} y={5} width={24} height={7} fill="none" stroke={lineThin} strokeWidth={0.4} />
      <circle cx={50} cy={17} r={0.8} fill={lineThin} />
      <path d="M 42 23 A 9 9 0 0 0 58 23" fill="none" stroke={lineThin} strokeWidth={0.4} />

      <rect x={26} y={117} width={48} height={18} fill="none" stroke={lineColor} strokeWidth={0.4} />
      <rect x={38} y={128} width={24} height={7} fill="none" stroke={lineColor} strokeWidth={0.4} />
      <circle cx={50} cy={123} r={0.8} fill={lineColor} />
      <path d="M 42 117 A 9 9 0 0 1 58 117" fill="none" stroke={lineColor} strokeWidth={0.4} />

      <line x1={43} y1={5} x2={57} y2={5} stroke={lineColor} strokeWidth={1} />
      <line x1={43} y1={135} x2={57} y2={135} stroke={lineColor} strokeWidth={1} />

      <path d="M 5 7 A 2 2 0 0 0 7 5" fill="none" stroke={lineThin} strokeWidth={0.3} />
      <path d="M 93 5 A 2 2 0 0 0 95 7" fill="none" stroke={lineThin} strokeWidth={0.3} />
      <path d="M 5 133 A 2 2 0 0 1 7 135" fill="none" stroke={lineThin} strokeWidth={0.3} />
      <path d="M 93 135 A 2 2 0 0 1 95 133" fill="none" stroke={lineThin} strokeWidth={0.3} />
    </svg>
  )
}
