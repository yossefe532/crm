
export const STAGE_LABELS: Record<string, string> = {
  new: "جديد",
  call: "مكالمة هاتفية",
  meeting: "اجتماع",
  site_visit: "رؤية الموقع",
  closing: "إغلاق الصفقة",
  won: "ناجحة",
  lost: "خاسرة"
}

export const STAGE_COLORS: Record<string, "default" | "info" | "success" | "warning" | "danger" | "outline"> = {
  new: "default",
  call: "info",
  meeting: "info",
  site_visit: "warning",
  closing: "outline",
  won: "success",
  lost: "danger"
}

export const STAGES = ["new", "call", "meeting", "site_visit", "closing", "won", "lost"]

export const FINANCE_CATEGORY_LABELS: Record<string, string> = {
  "sales_revenue": "عائد مبيعات",
  "salary": "رواتب",
  "rent": "إيجار",
  "commission": "عمولات",
  "marketing": "تسويق",
  "office": "مصاريف مكتبية",
  "software": "برمجيات",
  "utilities": "مرافق",
  "other": "أخرى"
}

export const FINANCE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']
