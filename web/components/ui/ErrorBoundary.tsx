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
        <div style={{ padding: "2rem", textAlign: "center", direction: "rtl" }}>
          <div style={{ maxWidth: "500px", margin: "0 auto", backgroundColor: "#fff", padding: "2rem", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#e11d48", marginBottom: "1rem" }}>عذراً، حدث خطأ ما</h2>
            <p style={{ color: "#475569", marginBottom: "1rem" }}>
              حدث خطأ غير متوقع في عرض هذه الصفحة.
            </p>
            <div style={{ backgroundColor: "#f1f5f9", padding: "1rem", borderRadius: "4px", textAlign: "left", fontSize: "0.875rem", color: "#64748b", overflow: "auto", maxHeight: "150px", marginBottom: "1rem", direction: "ltr" }}>
              {this.state.error?.message}
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              style={{
                width: "100%",
                padding: "0.75rem",
                backgroundColor: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
