"use client"

import { ReactNode, useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="fixed inset-0 bg-base-900/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg transform rounded-xl bg-base-0 p-6 shadow-xl transition-all dark:bg-base-800">
        <div className="mb-4 flex items-center justify-between border-b border-base-100 pb-4 dark:border-base-700">
          <h3 className="text-lg font-semibold text-base-900 dark:text-base-50">
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
        <div className="max-h-[80vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
