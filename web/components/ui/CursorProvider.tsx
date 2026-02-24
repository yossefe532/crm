"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useTheme } from "../../lib/theme/ThemeProvider"

interface Point {
  x: number
  y: number
}

interface CursorState {
  pos: Point
  vel: Point
  target: Point
  scale: number
  angle: number
  squeezed: boolean
  hovering: boolean
  clicking: boolean
  textMode: boolean
}

export const CursorProvider = () => {
  const { theme } = useTheme()
  const cursorRef = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // Physics state
  const state = useRef<CursorState>({
    pos: { x: -100, y: -100 },
    vel: { x: 0, y: 0 },
    target: { x: -100, y: -100 },
    scale: 1,
    angle: 0,
    squeezed: false,
    hovering: false,
    clicking: false,
    textMode: false
  })

  // Configuration
  const config = {
    lerp: 0.15, // Smoothness (lower = smoother/slower)
    maxStretch: 1.5, // Max stretch factor
    velThreshold: 0.1, // Minimum movement to trigger stretch
    hoverScale: 1.5,
    clickScale: 0.8,
    textScale: 0.5
  }

  // Mobile Ripple Effect
  const createRipple = useCallback((x: number, y: number) => {
    const ripple = document.createElement("div")
    ripple.className = "mobile-ripple"
    ripple.style.left = `${x}px`
    ripple.style.top = `${y}px`
    document.body.appendChild(ripple)

    ripple.addEventListener("animationend", () => {
      ripple.remove()
    })
  }, [])

  useEffect(() => {
    // Environment check
    const checkEnv = () => {
      const isTouch = window.matchMedia("(hover: none)").matches
      const isSmall = window.innerWidth < 768
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      
      const shouldEnable = !isTouch && !isSmall && !reducedMotion
      setIsMobile(isTouch || isSmall)
      setEnabled(shouldEnable)

      if (shouldEnable) {
        document.documentElement.classList.add("cursor-custom-enabled")
      } else {
        document.documentElement.classList.remove("cursor-custom-enabled")
      }
    }

    checkEnv()
    window.addEventListener("resize", checkEnv)
    return () => {
      window.removeEventListener("resize", checkEnv)
      document.documentElement.classList.remove("cursor-custom-enabled")
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      // Mobile tap listener
      if (isMobile) {
        const handleTap = (e: TouchEvent) => {
          const touch = e.touches[0]
          createRipple(touch.clientX, touch.clientY)
        }
        window.addEventListener("touchstart", handleTap)
        return () => window.removeEventListener("touchstart", handleTap)
      }
      return
    }

    const cursor = cursorRef.current
    if (!cursor) return

    let rafId: number

    const onMove = (e: MouseEvent) => {
      state.current.target = { x: e.clientX, y: e.clientY }
      
      // Hover detection
      const target = e.target as HTMLElement
      const isClickable = !!target.closest("a, button, [role='button'], input[type='submit'], .clickable")
      const isText = !!target.closest("input[type='text'], textarea, [contenteditable='true']")
      
      state.current.hovering = isClickable
      state.current.textMode = isText
    }

    const onDown = () => { state.current.clicking = true }
    const onUp = () => { state.current.clicking = false }

    const update = () => {
      const s = state.current
      
      // Physics interpolation
      const dx = s.target.x - s.pos.x
      const dy = s.target.y - s.pos.y
      
      s.pos.x += dx * config.lerp
      s.pos.y += dy * config.lerp
      
      // Velocity for stretch
      const vx = dx * config.lerp
      const vy = dy * config.lerp
      const speed = Math.sqrt(vx * vx + vy * vy)
      
      // Calculate rotation angle based on movement direction
      if (speed > config.velThreshold) {
        s.angle = Math.atan2(vy, vx) * (180 / Math.PI)
      }

      // Calculate stretch scale
      const stretch = Math.min(1 + speed * 0.05, config.maxStretch)
      const inverseStretch = 1 / stretch

      // Target scale based on state
      let targetScale = 1
      if (s.textMode) targetScale = config.textScale
      else if (s.clicking) targetScale = config.clickScale
      else if (s.hovering) targetScale = config.hoverScale

      // Apply transform
      const transform = [
        `translate3d(${s.pos.x}px, ${s.pos.y}px, 0)`,
        `translate(-50%, -50%)`,
        `rotate(${s.angle}deg)`,
        `scale(${stretch * targetScale}, ${inverseStretch * targetScale})`
      ].join(" ")

      cursor.style.transform = transform
      
      rafId = requestAnimationFrame(update)
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    window.addEventListener("mousedown", onDown)
    window.addEventListener("mouseup", onUp)
    
    rafId = requestAnimationFrame(update)

    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("mouseup", onUp)
      cancelAnimationFrame(rafId)
    }
  }, [enabled, isMobile, createRipple])

  if (!enabled) return null

  return (
    <div 
      ref={cursorRef}
      className={`fluid-cursor ${theme === 'dark' ? 'fluid-cursor-dark' : 'fluid-cursor-light'}`}
    />
  )
}
