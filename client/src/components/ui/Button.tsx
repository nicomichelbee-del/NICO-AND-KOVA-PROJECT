import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const base =
  'group relative inline-flex items-center justify-center gap-2 font-medium tracking-tight rounded-full overflow-hidden ' +
  'transition-[transform,box-shadow,background,color,border-color] duration-200 ease-out ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ' +
  "before:content-[''] before:absolute before:inset-0 before:rounded-full before:pointer-events-none " +
  'before:bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.30)_48%,rgba(255,255,255,0)_60%)] ' +
  'before:-translate-x-[120%] before:transition-transform before:duration-700 ' +
  'hover:before:translate-x-[120%] before:mix-blend-overlay before:z-[1] ' +
  '[&>*]:relative [&>*]:z-[2]'

const variants = {
  gold:
    'text-[#1a1304] ' +
    'bg-[linear-gradient(180deg,#f5c170_0%,#e0982e_100%)] ' +
    'shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_-1px_0_rgba(0,0,0,0.15)_inset,0_8px_22px_rgba(240,182,90,0.18)] ' +
    'hover:bg-[linear-gradient(180deg,#ffd28a_0%,#e8a23a_100%)] ' +
    'hover:shadow-[0_1px_0_rgba(255,255,255,0.55)_inset,0_-1px_0_rgba(0,0,0,0.18)_inset,0_0_0_8px_rgba(240,182,90,0.16),0_0_32px_rgba(240,182,90,0.55),0_22px_50px_rgba(240,182,90,0.40)] ' +
    'hover:-translate-y-[2px] hover:scale-[1.035]',
  outline:
    'text-ink-0 border border-[rgba(245,241,232,0.18)] bg-[rgba(245,241,232,0.04)] backdrop-blur-md ' +
    'hover:bg-[rgba(245,241,232,0.10)] hover:border-[rgba(245,241,232,0.55)] hover:text-white ' +
    'hover:shadow-[0_0_0_6px_rgba(245,241,232,0.05),0_0_28px_rgba(240,182,90,0.18),0_14px_36px_rgba(0,0,0,0.35)] ' +
    'hover:-translate-y-[2px] hover:scale-[1.03]',
  ghost:
    'text-ink-1 hover:text-gold rounded-md before:hidden',
  danger:
    'text-white bg-[linear-gradient(180deg,#e35a5a_0%,#c94545_100%)] ' +
    'shadow-[0_8px_22px_rgba(201,69,69,0.25)] ' +
    'hover:shadow-[0_0_0_6px_rgba(227,90,90,0.18),0_22px_50px_rgba(201,69,69,0.40)] ' +
    'hover:-translate-y-[2px] hover:scale-[1.035]',
}

const sizes = {
  sm: 'px-4 py-2 text-[13px]',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-[15px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'gold', size = 'md', className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      <span className="inline-flex items-center gap-2">{children}</span>
    </button>
  ),
)
Button.displayName = 'Button'
