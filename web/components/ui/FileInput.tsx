"use client"

import { ChangeEvent, forwardRef, InputHTMLAttributes, useRef } from "react"
import { Button, ButtonProps } from "./Button"

export interface FileInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  buttonProps?: ButtonProps
  label?: React.ReactNode
  loading?: boolean
  loadingText?: string
}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, onChange, accept, disabled, buttonProps, label = "Upload", loading = false, loadingText = "Loading...", ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null)

    const handleClick = () => {
      inputRef.current?.click()
    }

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e)
      }
    }

    return (
      <>
        <input
          {...props}
          type="file"
          className="hidden"
          ref={(node) => {
            // Merge refs
            if (typeof ref === "function") {
              ref(node)
            } else if (ref) {
              ref.current = node
            }
            inputRef.current = node
          }}
          onChange={handleChange}
          accept={accept}
          disabled={disabled || loading}
        />
        <Button
          type="button"
          onClick={handleClick}
          disabled={disabled || loading}
          {...buttonProps}
          className={className}
        >
          {loading ? loadingText : label}
        </Button>
      </>
    )
  }
)

FileInput.displayName = "FileInput"
