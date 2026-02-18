"use client"

import { SelectHTMLAttributes, forwardRef } from "react"

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options?: { label: string; value: string | number }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, error, options, children, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium text-base-700 dark:text-base-200">
            {label}
          </label>
        )}
        <select
          ref={ref}
          disabled={disabled}
          className={`
            block w-full rounded-lg border border-base-200 bg-base-0 px-3 py-2 text-sm text-base-900 shadow-sm transition-colors
            focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
            disabled:cursor-not-allowed disabled:bg-base-50 disabled:text-base-500
            dark:border-base-700 dark:bg-base-900 dark:text-white dark:focus:border-brand-500 dark:focus:ring-brand-500
            ${error ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" : ""}
            ${className}
          `}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      </div>
    )
  }
)

Select.displayName = "Select"
