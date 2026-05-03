import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={`w-full bg-[rgba(245,241,232,0.03)] border border-[rgba(245,241,232,0.10)] rounded-xl px-4 py-3 text-[15px] leading-[1.55] text-ink-0 placeholder-ink-3 caret-gold focus:outline-none focus:border-[rgba(240,182,90,0.55)] focus:ring-[3px] focus:ring-[rgba(240,182,90,0.18)] focus:bg-[rgba(245,241,232,0.05)] transition-[border-color,background,box-shadow] duration-200 resize-none ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs text-crimson-light">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  ),
)
Textarea.displayName = 'Textarea'
