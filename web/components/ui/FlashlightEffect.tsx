"use client"

import { useEffect, useRef, useState } from "react"

export default function FlashlightEffect() {
  const [isDark, setIsDark] = useState(false)
  const glowRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkTheme = () => {
      // Check for 'dark' class on html or data-theme='dark'
      const isDarkMode = document.documentElement.classList.contains("dark") || 
                         document.documentElement.getAttribute("data-theme") === "dark"
      setIsDark(isDarkMode)
    }

    checkTheme()
    
    // Observer for class changes on html to detect theme switch
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] })

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDark) return
      
      // Optimization: Disable on mobile/touch devices
      if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return null
      if (window.innerWidth < 768) return null

      const { clientX: x, clientY: y } = e
      
      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(600px at ${x}px ${y}px, rgba(255, 255, 255, 0.03), transparent 40%)`
      }
      if (centerRef.current) {
        centerRef.current.style.background = `radial-gradient(150px at ${x}px ${y}px, rgba(255, 255, 255, 0.05), transparent 50%)`
      }
      if (cursorRef.current) {
        // Simple follow
        cursorRef.current.style.transform = `translate(${x - 8}px, ${y - 8}px)`
      }
    }

    // Only add listener if not mobile
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
        window.addEventListener("mousemove", handleMouseMove)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      observer.disconnect()
    }
  }, [isDark])

  if (!isDark) return null

  return (
    <>
      {/* Primary Glow (Wide Flashlight Beam) */}
      <div
        ref={glowRef}
        className="fixed inset-0 z-[9998] transition-opacity duration-300 hidden md:block pointer-events-none"
      />
      
      {/* Secondary Glow (Intense Center) */}
      <div
        ref={centerRef}
        className="fixed inset-0 z-[9998] transition-opacity duration-300 hidden md:block pointer-events-none"
      />

      {/* Cursor Highlight (The actual "lamp" bulb effect) */}
      <div 
        ref={cursorRef}
        className="fixed z-[9999] w-4 h-4 rounded-full bg-white/20 blur-[1px] top-0 left-0 hidden md:block pointer-events-none"
        style={{
          boxShadow: "0 0 15px 2px rgba(255, 255, 255, 0.3)"
        }}
      />
    </>
  )
}
