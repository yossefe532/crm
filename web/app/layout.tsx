import "./globals.css"
import { ReactNode } from "react"
import { Providers } from "./providers"
import { Metadata, Viewport } from "next"
import dynamic from "next/dynamic"

const FlashlightEffect = dynamic(() => import("../components/ui/FlashlightEffect"), {
  ssr: false,
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
}

export const metadata: Metadata = {
  title: "نظام إدارة علاقات العملاء العقاري",
  description: "لوحة تحكم احترافية لإدارة العملاء العقاريين",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CRM Doctor",
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/maskable-icon.svg" />
      </head>
      <body className="font-ar bg-base-50">
        <FlashlightEffect />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
