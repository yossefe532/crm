import { useEffect, useRef } from "react"

export const useMagnetic = (enabled = true, strength = 3) => {
  const ref = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const element = ref.current
    if (!element) return
    let frame = 0
    const update = (x: number, y: number) => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        element.style.setProperty("--mx", `${x}px`)
        element.style.setProperty("--my", `${y}px`)
      })
    }
    const handleMove = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect()
      const relX = event.clientX - rect.left - rect.width / 2
      const relY = event.clientY - rect.top - rect.height / 2
      const offsetX = Math.max(-strength, Math.min(strength, relX * 0.08))
      const offsetY = Math.max(-strength, Math.min(strength, relY * 0.08))
      update(offsetX, offsetY)
    }
    const handleLeave = () => {
      update(0, 0)
    }
    element.addEventListener("mousemove", handleMove)
    element.addEventListener("mouseleave", handleLeave)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      element.removeEventListener("mousemove", handleMove)
      element.removeEventListener("mouseleave", handleLeave)
    }
  }, [enabled, strength])

  return ref
}
