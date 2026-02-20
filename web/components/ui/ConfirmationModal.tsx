"use client"

import { Button } from "./Button"
import { Modal } from "./Modal"

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "warning" | "info"
}

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  variant = "danger"
}: ConfirmationModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-base-600 dark:text-base-300">{description}</p>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "primary" : "secondary"}
            className={variant === "danger" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
