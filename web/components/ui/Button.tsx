"use client"

import { ButtonHTMLAttributes, ReactNode } from "react"
import { useMagnetic } from "../../lib/hooks/useMagnetic"

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "warning" | "info" | "outline"
  size?: "sm" | "md" | "lg"
  isLoading?: boolean
}

const styles = {
  primary: "bg-brand-500 text-black hover:bg-brand-600 focus:ring-brand-500",
  secondary: "bg-base-0 text-base-900 border border-base-200 hover:bg-base-100 focus:ring-base-200",
  ghost: "bg-transparent text-base-700 hover:bg-base-100 focus:ring-base-200",
  danger: "bg-rose-100 text-rose-700 hover:bg-rose-200 focus:ring-rose-200",
  success: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 focus:ring-emerald-200",
  warning: "bg-amber-100 text-amber-700 hover:bg-amber-200 focus:ring-amber-200",
  info: "bg-sky-100 text-sky-700 hover:bg-sky-200 focus:ring-sky-200",
  outline: "border border-base-200 text-base-600 hover:bg-base-50 focus:ring-base-200"
}

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base"
}

export const Button = ({ children, variant = "primary", size = "md", isLoading, className = "", disabled, ...props }: ButtonProps) => {
  const magneticRef = useMagnetic(true, 3)
  
  return (
    <button
      ref={magneticRef}
      className={`btn-interactive btn-ripple btn-magnetic inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${styles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  )
}
