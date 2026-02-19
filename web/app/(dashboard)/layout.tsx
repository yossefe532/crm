import { ReactNode } from "react"
import { DashboardShell } from "../../components/layout/DashboardShell"
import { DashboardProvider } from "../../lib/state/DashboardState"
import { ErrorBoundary } from "../../components/ui/ErrorBoundary"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <ErrorBoundary>
        <DashboardShell>{children}</DashboardShell>
      </ErrorBoundary>
    </DashboardProvider>
  )
}
