"use client"

import { useMemo } from "react"

interface Props {
  password: string
}

export const PasswordStrength = ({ password }: Props) => {
  const strength = useMemo(() => {
    let score = 0
    if (password.length >= 8) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }, [password])

  if (!password) return null

  const getColor = (score: number) => {
    if (score < 3) return "bg-red-500"
    if (score < 5) return "bg-yellow-500"
    return "bg-green-500"
  }

  const getLabel = (score: number) => {
    if (score < 3) return "ضعيفة"
    if (score < 5) return "متوسطة"
    return "قوية"
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <div className="flex h-1 flex-1 gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-full flex-1 rounded-full transition-all ${
              i <= strength ? getColor(strength) : "bg-base-200"
            }`}
          />
        ))}
      </div>
      <span className={`${strength < 3 ? "text-red-500" : strength < 5 ? "text-yellow-600" : "text-green-600"}`}>
        {getLabel(strength)}
      </span>
    </div>
  )
}
