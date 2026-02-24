"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useScroll, useTransform } from "framer-motion"

export const AnimatedBackground = () => {
  // Use a state to trigger animation only after mount to avoid hydration mismatch
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0a0a0a] text-white">
      {/* Deep Space Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-[#111111]" />
      
      {/* Futuristic Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      
      {mounted && (
        <>
           {/* Ambient Gold Glow (Brand) - Top Left */}
          <motion.div
            animate={{
              opacity: [0.15, 0.25, 0.15],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-[#d4af37] blur-[120px] mix-blend-screen opacity-20"
          />

          {/* Deep Warm Glow (Secondary) - Bottom Right */}
          <motion.div
            animate={{
              opacity: [0.1, 0.2, 0.1],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
            className="absolute -bottom-[20%] -right-[10%] w-[70vw] h-[70vw] rounded-full bg-[#8a6a1f] blur-[150px] mix-blend-screen opacity-15"
          />

          {/* White/Silver Accent (Tech) - Center Floating */}
          <motion.div
            animate={{
              x: [0, 50, -50, 0],
              y: [0, -30, 30, 0],
              opacity: [0.03, 0.08, 0.03],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute top-[30%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-slate-700 blur-[100px] mix-blend-screen opacity-10"
          />
          
          {/* Particles */}
          <div className="absolute inset-0 opacity-20">
             {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                    y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
                    opacity: Math.random() * 0.5 + 0.3,
                  }}
                  animate={{
                    y: [null, Math.random() * -100],
                    opacity: [null, 0],
                  }}
                  transition={{
                    duration: Math.random() * 10 + 10,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute w-1 h-1 bg-white rounded-full"
                  style={{
                    left: 0,
                    top: 0,
                  }}
                />
             ))}
          </div>
        </>
      )}
    </div>
  )
}
