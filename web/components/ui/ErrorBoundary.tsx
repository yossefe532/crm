"use client"

import { Component, ErrorInfo, ReactNode } from "react"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"

interface Props {
  children: ReactNode
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
      return (
        <div className="flex h-full w-full items-center justify-center p-6">
          <Card className="max-w-md w-full text-center p-6">
            <h2 className="text-xl font-bold text-rose-600 mb-2">عذراً، حدث خطأ ما</h2>
            <p className="text-base-600 mb-4 text-sm">
              حدث خطأ غير متوقع في عرض هذه الصفحة.
            </p>
            <div className="bg-base-100 p-3 rounded text-left text-xs text-base-500 overflow-auto max-h-32 mb-4 dir-ltr">
              {this.state.error?.message}
            </div>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="w-full"
            >
              إعادة تحميل الصفحة
            </Button>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
