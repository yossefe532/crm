export const Progress = ({ value, tone = "brand" }: { value: number; tone?: "brand" | "success" | "warning" | "danger" }) => {
  const colorMap = {
    brand: "bg-brand-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500"
  }
  return (
    <div className="h-2 w-full rounded-full bg-base-100">
      <div className={`h-2 rounded-full ${colorMap[tone] || "bg-brand-500"}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}
