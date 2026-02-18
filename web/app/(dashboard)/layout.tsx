import { ReactNode } from "react"
import { DashboardShell } from "../../components/layout/DashboardShell"
import { DashboardProvider } from "../../lib/state/DashboardState"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  )
}
