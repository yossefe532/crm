"use client"

import Image from "next/image"
import { Card } from "../ui/Card"

export type IconItem = {
  id: string
  label: string
  url: string
  hint?: string
}

type Props = {
  title?: string
  items: IconItem[]
  variant?: "card" | "inline"
}

export const IconShowcase = ({ title, items, variant = "card" }: Props) => {
  const content = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="group flex items-center gap-3 rounded-xl border border-base-100 bg-base-50 px-3 py-3 shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transition-none"
          title={item.label}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-base-0 shadow-sm">
            <Image
              src={item.url}
              alt={item.label}
              width={36}
              height={36}
              className="h-9 w-9 object-contain transition-transform duration-200 group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none"
              loading="lazy"
              unoptimized
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-base-900">{item.label}</p>
            {item.hint && <p className="text-xs text-base-500">{item.hint}</p>}
          </div>
        </div>
      ))}
    </div>
  )

  if (variant === "inline") {
    return content
  }

  return <Card title={title}>{content}</Card>
}
