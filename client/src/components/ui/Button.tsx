import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  gold: 'bg-[#eab308] text-black font-bold hover:bg-[#f0c010] hover:shadow-[0_4px_32px_rgba(234,179,8,0.25)] transition-all',
  outline: 'border border-[rgba(234,179,8,0.3)] text-[#f1f5f9] hover:border-[#eab308] hover:text-[#eab308] transition-all',
  ghost: 'text-[#64748b] hover:text-[#f1f5f9] transition-colors',
}

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-md',
  md: 'px-6 py-3 text-sm rounded-lg',
  lg: 'px-8 py-4 text-base rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'gold', size = 'md', className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
