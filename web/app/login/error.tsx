"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">حدث خطأ ما</h2>
      <p className="mb-6 text-gray-600 dark:text-gray-400">نعتذر عن هذا الخطأ. حاول إعادة تحميل الصفحة.</p>
      <button
        onClick={() => reset()}
        className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        إعادة المحاولة
      </button>
    </div>
  )
}
