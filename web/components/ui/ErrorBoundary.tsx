"use client"

import { Component, ErrorInfo, ReactNode } from "react"
import { Button } from "./Button"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-lg border border-base-200 bg-base-0 p-8 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-base-900">حدث خطأ غير متوقع</h2>
          <p className="mb-6 max-w-md text-base-500">
            نعتذر عن هذا الخطأ. يمكنك محاولة تحديث الصفحة أو العودة للصفحة الرئيسية.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              تحديث الصفحة
            </Button>
            <Button
              variant="primary"
              onClick={() => window.location.href = "/"}
            >
              الرئيسية
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <div className="mt-8 max-h-48 w-full overflow-auto rounded bg-base-900 p-4 text-left text-xs text-white" dir="ltr">
              <pre>{this.state.error.toString()}</pre>
            </div>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
