"use client"

import { useEffect, useState } from "react"
import { LoginForm } from "../../components/login/LoginForm"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { motion } from "framer-motion"

export default function LoginPage() {
  const [mounted, setMounted] = useState(false)
  const { dir } = useLocale()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div 
      className="min-h-screen w-full flex bg-[#0a0a0a] text-white font-sans selection:bg-[#d4af37]/30"
      dir={dir}
    >
      {/* Left Side - Visual/Brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#121212]">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2301&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/80 via-[#0a0a0a]/40 to-[#0a0a0a]/90" />
        
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3"
          >
            <div className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center bg-white/5 border border-white/10">
              <img src="https://i.postimg.cc/d34tN5qL/Whats-App-Image-2026-02-18-at-7-11-57-PM.jpg" alt="Ambulance Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">CRM DOCTOR</span>
          </motion.div>

          <div className="space-y-6 max-w-lg">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-5xl font-bold leading-tight"
            >
              Transform Your <span className="text-[#d4af37]">Real Estate</span> Management
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-slate-400"
            >
              Streamline your workflow, manage leads efficiently, and close more deals with our comprehensive CRM solution designed for professionals.
            </motion.p>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-4 text-sm text-slate-500"
          >
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-[#121212] bg-slate-800" />
              ))}
            </div>
            <p>Trusted by 500+ Professionals</p>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 bg-[#0a0a0a]">
        {/* Mobile Logo */}
        <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-white/5 border border-white/10">
              <img src="https://i.postimg.cc/d34tN5qL/Whats-App-Image-2026-02-18-at-7-11-57-PM.jpg" alt="Ambulance Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">CRM DOCTOR</span>
        </div>

        <div className="w-full max-w-[440px]">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
