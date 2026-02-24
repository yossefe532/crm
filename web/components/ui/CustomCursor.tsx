"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "../../lib/theme/ThemeProvider"

const lerp = (from: number, to: number, alpha: number) => from + (to - from) * alpha

export const CustomCursor = () => {
  const { theme } = useTheme()
  const dotRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)
  
  // State for positions and interaction
  const stateRef = useRef({ 
    tx: -100, ty: -100, // Target (mouse) position
    dx: -100, dy: -100, // Dot position
    rx: -100, ry: -100, // Ring position
    visible: false, 
    mode: "default", // default, pointer, text
    pressed: false 
  })
  
  const [enabled, setEnabled] = useState(false) // Start false to prevent hydration mismatch
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check environment capabilities
    const checkEnvironment = () => {
      const isTouch = window.matchMedia("(hover: none)").matches
      const isSmallScreen = window.innerWidth < 768
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      
      const shouldEnable = !isTouch && !isSmallScreen && !reducedMotion
      
      setIsMobile(isSmallScreen || isTouch)
      setEnabled(shouldEnable)
      
      // Force remove default cursor if enabled
      if (shouldEnable) {
        document.documentElement.classList.add("cursor-custom")
      } else {
        document.documentElement.classList.remove("cursor-custom")
      }
    }

    checkEnvironment()
    window.addEventListener("resize", checkEnvironment)
    
    return () => {
      window.removeEventListener("resize", checkEnvironment)
      document.documentElement.classList.remove("cursor-custom")
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return
    
    let frame: number
    
    const update = () => {
      const state = stateRef.current
      
      // Interpolate positions
      // Dot follows closely (0.5 factor)
      state.dx = lerp(state.dx, state.tx, 0.5)
      state.dy = lerp(state.dy, state.ty, 0.5)
      
      // Ring follows slowly (0.15 factor) for "lag" effect
      state.rx = lerp(state.rx, state.tx, 0.15)
      state.ry = lerp(state.ry, state.ty, 0.15)
      
      // Apply transforms with translate3d for GPU acceleration
      if (dot) {
        dot.style.transform = `translate3d(${state.dx}px, ${state.dy}px, 0) translate(-50%, -50%) scale(${state.pressed ? 0.8 : (state.mode === 'pointer' ? 0.5 : (state.mode === 'text' ? 0.5 : 1))})`
        dot.style.opacity = state.visible ? (state.mode === 'text' ? "0.5" : "1") : "0"
      }
      
      if (ring) {
        ring.style.transform = `translate3d(${state.rx}px, ${state.ry}px, 0) translate(-50%, -50%) scale(${state.pressed ? 0.9 : (state.mode === 'pointer' ? 1.5 : (state.mode === 'text' ? 1 : 1))})`
        ring.style.opacity = state.visible ? (state.mode === 'text' ? "0" : "1") : "0"
        ring.dataset.mode = state.mode
        ring.dataset.pressed = String(state.pressed)
      }

      frame = requestAnimationFrame(update)
    }
    
    frame = requestAnimationFrame(update)

    // Event Handlers
    const onMove = (e: MouseEvent) => {
      stateRef.current.tx = e.clientX
      stateRef.current.ty = e.clientY
      stateRef.current.visible = true
      
      // Detect hover target
      const target = e.target as HTMLElement
      if (!target) return

      // Determine mode based on interactive elements
      let newMode = "default"
      if (target.closest("a, button, [role='button'], input[type='submit'], input[type='button'], .clickable, label")) {
        newMode = "pointer"
      } else if (target.closest("input, textarea, [contenteditable='true']")) {
        newMode = "text"
      }
      
      stateRef.current.mode = newMode
    }

    const onDown = () => { stateRef.current.pressed = true }
    const onUp = () => { stateRef.current.pressed = false }
    const onLeave = () => { stateRef.current.visible = false }
    const onEnter = () => { stateRef.current.visible = true }

    window.addEventListener("mousemove", onMove, { passive: true })
    window.addEventListener("mousedown", onDown)
    window.addEventListener("mouseup", onUp)
    document.addEventListener("mouseleave", onLeave)
    document.addEventListener("mouseenter", onEnter)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("mouseup", onUp)
      document.removeEventListener("mouseleave", onLeave)
      document.removeEventListener("mouseenter", onEnter)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div className="lux-cursor-system" aria-hidden="true">
      {/* Outer Ring */}
      <div 
        ref={ringRef} 
        className={`lux-cursor-ring ${theme === 'dark' ? 'ring-gold' : 'ring-dark'}`}
      />
      
      {/* Core Dot */}
      <div 
        ref={dotRef} 
        className={`lux-cursor-dot ${theme === 'dark' ? 'dot-gold' : 'dot-dark'}`}
      />
    </div>
  )
}
