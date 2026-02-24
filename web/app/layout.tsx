import "./globals.css"
import { ReactNode } from "react"
import { Providers } from "./providers"
import { Metadata, Viewport } from "next"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
  interactiveWidget: "resizes-content",
}

export const metadata: Metadata = {
  title: "نظام إدارة علاقات العملاء العقاري",
  description: "لوحة تحكم احترافية لإدارة العملاء العقاريين",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/system-icon.jpg", sizes: "192x192", type: "image/jpeg" },
      { url: "/icons/system-icon.jpg", type: "image/jpeg" },
    ],
    apple: [
      { url: "/icons/system-icon.jpg", sizes: "512x512", type: "image/jpeg" },
    ],
    shortcut: ["/icons/system-icon.jpg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CRM Doctor",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  formatDetection: {
    telephone: false,
  },
}

import { ErrorBoundary } from "../components/ui/ErrorBoundary"

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="font-ar bg-base-50 text-base-900" suppressHydrationWarning>
        <ErrorBoundary>
          {/* <FlashlightEffect /> */}
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}
