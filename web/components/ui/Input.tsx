"use client"

import { InputHTMLAttributes, forwardRef, ReactNode } from "react"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  startIcon?: ReactNode
  endIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, startIcon, endIcon, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium text-base-700 dark:text-base-200">
            {label}
          </label>
        )}
        <div className="relative">
          {startIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-base-500">
              {startIcon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={`
              block w-full rounded-lg border bg-base-0 px-3 py-2 text-sm text-base-900 shadow-sm transition-colors
              placeholder:text-base-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
              disabled:cursor-not-allowed disabled:bg-base-50 disabled:text-base-500
              dark:border-base-700 dark:bg-base-900 dark:text-white dark:placeholder:text-base-400 dark:focus:border-brand-500 dark:focus:ring-brand-500
              ${error ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" : "border-base-200"}
              ${startIcon ? "pr-10" : ""}
              ${endIcon ? "pl-10" : ""}
              ${className}
            `}
            {...props}
          />
          {endIcon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-base-500">
              {endIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      </div>
    )
  }
)

Input.displayName = "Input"
