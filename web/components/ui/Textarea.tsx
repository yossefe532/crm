"use client"

import { TextareaHTMLAttributes, forwardRef, useId } from "react"

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  containerClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", containerClassName = "", label, error, disabled, id, ...props }, ref) => {
    const generatedId = useId()
    const textareaId = id || generatedId

    return (
      <div className={`w-full ${containerClassName}`}>
        {label && (
          <label htmlFor={textareaId} className="mb-1.5 block text-sm font-medium text-base-700 dark:text-base-200">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          disabled={disabled}
          className={`
            block w-full rounded-lg border border-base-200 bg-base-0 px-3 py-2 text-base sm:text-sm text-base-900 shadow-sm transition-colors
            placeholder:text-base-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
            disabled:cursor-not-allowed disabled:bg-base-50 disabled:text-base-500
            dark:border-base-700 dark:bg-base-900 dark:text-white dark:placeholder:text-base-400 dark:focus:border-brand-500 dark:focus:ring-brand-500
            ${error ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" : ""}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = "Textarea"
