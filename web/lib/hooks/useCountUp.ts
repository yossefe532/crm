import { useEffect, useRef, useState } from "react"

export const useCountUp = (value: number, duration = 800, enabled = true) => {
  const [current, setCurrent] = useState(0)
  const startRef = useRef(0)
  const valueRef = useRef(value)

  useEffect(() => {
    if (!enabled || Number.isNaN(value)) {
      setCurrent(value)
      return
    }
    valueRef.current = value
    startRef.current = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - startRef.current) / duration)
      const eased = 1 - Math.pow(1 - elapsed, 3)
      setCurrent(valueRef.current * eased)
      if (elapsed < 1) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [value, duration, enabled])

  return current
}
