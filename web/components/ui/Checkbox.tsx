"use client"

import { InputHTMLAttributes, forwardRef, ReactNode } from "react"

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode
  error?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <label className={`flex items-start gap-3 ${props.disabled ? "cursor-not-allowed" : "cursor-pointer"} group`}>
          <input
            type="checkbox"
            ref={ref}
            className={`
              peer h-5 w-5 shrink-0 rounded border-base-300 text-brand-600 shadow-sm transition-all
              focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
              checked:bg-brand-600 checked:border-brand-600
              disabled:cursor-not-allowed disabled:opacity-50
              ${className}
            `}
            {...props}
          />
          {label && (
            <span className={`text-sm font-medium text-base-700 group-hover:text-base-900 transition-colors select-none pt-0.5 ${props.disabled ? "opacity-50" : ""}`}>
              {label}
            </span>
          )}
        </label>
        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>
    )
  }
)

Checkbox.displayName = "Checkbox"
