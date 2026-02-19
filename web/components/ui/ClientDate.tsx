"use client"

import { useEffect, useState } from "react"

type ClientDateProps = {
  date: string | number | Date
  formatter?: (d: Date) => string
  fallback?: string
  className?: string
}

export const ClientDate = ({ 
  date, 
  formatter, 
  fallback = "...",
  className
}: ClientDateProps) => {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <span className={className}>{fallback}</span>

  const d = new Date(date)
  const text = formatter ? formatter(d) : d.toLocaleString("ar-EG")
  
  return <span className={className}>{text}</span>
}
