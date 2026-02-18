"use client"

import { useEffect } from "react"

export default function Home() {
  useEffect(() => {
    // Hard redirect using window location
    window.location.href = "/login"
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">جاري التحويل...</h1>
        <p className="text-gray-400">إذا لم يتم تحويلك تلقائياً، <a href="/login" className="text-blue-500 underline">اضغط هنا</a></p>
      </div>
    </div>
  )
}
