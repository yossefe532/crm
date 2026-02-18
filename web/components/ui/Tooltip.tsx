"use client"

import { ReactNode, useEffect, useRef, useState } from "react"
import { useLocale } from "../../lib/i18n/LocaleContext"

type Props = {
  text: string
  children: ReactNode
}

export const Tooltip = ({ text, children }: Props) => {
  const [visible, setVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const { dir } = useLocale()

  useEffect(() => {
    if (!visible || !tooltipRef.current) return
    const tooltip = tooltipRef.current
    const rect = tooltip.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    
    // Reset transform to calculate correctly
    tooltip.style.transform = 'translateX(-50%)'
    
    let offsetX = 0
    if (rect.left < 8) {
      offsetX = 8 - rect.left
    } else if (rect.right > viewportWidth - 8) {
      offsetX = (viewportWidth - 8) - rect.right
    }
    
    if (offsetX !== 0) {
      tooltip.style.transform = `translateX(calc(-50% + ${offsetX}px))`
    }
  }, [visible])

  return (
    <div
      className="relative inline-flex group"
      dir={dir}
    >
      <div 
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="inline-flex"
      >
        {children}
      </div>
      <div
        ref={tooltipRef}
        role="tooltip"
        className={`
          absolute left-1/2 z-50 mt-2 min-w-max -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-sm transition-opacity duration-200 dark:bg-gray-700
          ${visible ? "opacity-100 visible" : "opacity-0 invisible"}
        `}
        style={{ top: "100%" }}
      >
        {text}
      </div>
    </div>
  )
}
