"use client"

import { ReactNode, useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full"
}

export const Modal = ({ isOpen, onClose, title, children, size = "md" }: ModalProps) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    "2xl": "max-w-6xl",
    full: "max-w-[calc(100vw-2rem)]"
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
      <div 
        className="fixed inset-0 bg-base-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`relative w-full ${sizeClasses[size]} transform rounded-t-2xl sm:rounded-xl bg-base-0 p-4 sm:p-6 shadow-2xl transition-all dark:bg-base-800 dark:border dark:border-base-700 max-h-[90vh] flex flex-col`}>
        <div className="mb-4 flex items-center justify-between border-b border-base-100 pb-4 dark:border-base-700 shrink-0">
          <h3 className="text-xl font-bold text-base-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-base-400 hover:bg-base-100 hover:text-base-500 dark:hover:bg-base-700 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
