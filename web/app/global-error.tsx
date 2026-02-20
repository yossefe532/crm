"use client"

import { useEffect } from "react"
import { Button } from "../components/ui/Button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to an error reporting service
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body className="font-ar bg-base-50 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white p-8 rounded-2xl shadow-xl">
          <h2 className="text-2xl font-bold text-rose-600">عذراً، حدث خطأ جسيم</h2>
          <p className="text-base-600">
            واجه التطبيق مشكلة غير متوقعة. يرجى المحاولة مرة أخرى.
          </p>
          <div className="bg-base-100 p-4 rounded-lg text-left text-xs text-base-500 overflow-auto max-h-32 dir-ltr">
            {error.message}
          </div>
          <Button
            onClick={() => reset()}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white"
          >
            إعادة تحميل التطبيق
          </Button>
        </div>
      </body>
    </html>
  )
}
