"use client"

import { useEffect, useState } from "react"

export const Countdown = ({ hours }: { hours: number }) => {
  const [remaining, setRemaining] = useState(hours * 3600)

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 60))
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const hoursLeft = Math.floor(remaining / 3600)
  const minutesLeft = Math.floor((remaining % 3600) / 60)

  return (
    <span>{hoursLeft}س {minutesLeft}د</span>
  )
}
