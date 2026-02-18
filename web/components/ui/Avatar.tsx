"use client"

import { useMemo } from "react"

interface AvatarProps {
  src?: string | null
  alt?: string
  name?: string | null
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  className?: string
  status?: "online" | "offline" | "busy"
}

export const Avatar = ({ src, alt, name, size = "md", className = "", status }: AvatarProps) => {
  const initials = useMemo(() => {
    if (!name || !name.trim()) return "?"
    const parts = name.trim().split(" ").filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }, [name])

  const sizeClasses = {
    xs: "h-6 w-6 text-xs",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-xl",
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`flex items-center justify-center overflow-hidden rounded-full bg-base-200 text-base-600 dark:bg-base-700 dark:text-base-100 ${sizeClasses[size]}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt || name || "Avatar"} className="h-full w-full object-cover" />
        ) : (
          <span className="font-semibold">{initials}</span>
        )}
      </div>
      {status && (
        <span
          className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-base-900 ${
            status === "online"
              ? "bg-emerald-500"
              : status === "busy"
              ? "bg-rose-500"
              : "bg-base-400"
          }`}
        />
      )}
    </div>
  )
}
