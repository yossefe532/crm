import dynamic from "next/dynamic"

const CustomCursor = dynamic(() => import("../../components/ui/CustomCursor").then(mod => mod.CustomCursor), {
  ssr: false,
})

export const metadata = {
  title: "Sign in | CRM Dashboard",
  description: "Secure access to the CRM dashboard"
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* <CustomCursor /> */}
      {children}
    </>
  )
}
