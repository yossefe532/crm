"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "../../lib/theme/ThemeProvider"

const lerp = (from: number, to: number, alpha: number) => from + (to - from) * alpha

export const CustomCursor = () => {
  const { theme } = useTheme()
  const cursorRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef({ x: 0, y: 0, tx: 0, ty: 0, visible: false, mode: "default", pressed: false })
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem("cursor_mode")
    setEnabled(stored !== "default")
    const handleMode = () => {
      const next = window.localStorage.getItem("cursor_mode")
      setEnabled(next !== "default")
    }
    window.addEventListener("cursor-mode-change", handleMode)
    return () => window.removeEventListener("cursor-mode-change", handleMode)
  }, [])

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return
    const root = document.documentElement
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cursor.style.display = "none"
      root.classList.remove("cursor-custom")
      return
    }
    if (!enabled) {
      cursor.style.display = "none"
      root.classList.remove("cursor-custom")
      return
    }
    cursor.style.display = "block"
    root.classList.add("cursor-custom")
    let frame = 0
    const update = () => {
      const state = stateRef.current
      state.x = lerp(state.x, state.tx, 0.35)
      state.y = lerp(state.y, state.ty, 0.35)
      cursor.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`
      cursor.dataset.visible = state.visible ? "true" : "false"
      cursor.dataset.mode = state.mode
      cursor.dataset.pressed = state.pressed ? "true" : "false"
      frame = window.requestAnimationFrame(update)
    }
    frame = window.requestAnimationFrame(update)

    const resolveMode = (target: Element | null) => {
      if (!target) return "default"
      if (target.closest("input, textarea, select, [contenteditable='true']")) return "text"
      if (target.closest("a, button, [role='button'], [data-clickable='true']")) return "pointer"
      return "default"
    }

    const onMove = (event: MouseEvent) => {
      stateRef.current.tx = event.clientX
      stateRef.current.ty = event.clientY
      stateRef.current.visible = true
      stateRef.current.mode = resolveMode(document.elementFromPoint(event.clientX, event.clientY))
    }

    const onLeave = () => {
      stateRef.current.visible = false
    }

    const onDown = () => {
      stateRef.current.pressed = true
    }

    const onUp = () => {
      stateRef.current.pressed = false
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseleave", onLeave)
    window.addEventListener("mousedown", onDown)
    window.addEventListener("mouseup", onUp)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseleave", onLeave)
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("mouseup", onUp)
      root.classList.remove("cursor-custom")
    }
  }, [enabled])

  return (
    <div ref={cursorRef} className="lux-cursor" data-theme={theme} aria-hidden="true">
      <div className="lux-cursor__halo" />
      <div className="lux-cursor__dot" />
      <div className="lux-cursor__text" />
    </div>
  )
}
