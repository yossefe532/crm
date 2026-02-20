"use client"

import { Card } from "../ui/Card"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

import { useDashboardAnalytics } from "../../lib/hooks/useDashboardAnalytics"

export const PerformanceCharts = () => {
  const { data, isLoading, isError } = useDashboardAnalytics()

  const revenueData = data?.revenueOverTime || []
  const leadSourceData = data?.leadSources || []

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="h-[300px] w-full bg-base-200 animate-pulse rounded-lg" />
        </Card>
        <Card>
          <div className="h-[300px] w-full bg-base-200 animate-pulse rounded-lg" />
        </Card>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="h-[300px] w-full flex items-center justify_center text-sm text-rose-600">تعذر تحميل البيانات</div>
        </Card>
        <Card>
          <div className="h-[300px] w-full flex items-center justify_center text-sm text-rose-600">تعذر تحميل البيانات</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="إجمالي الإيرادات (شهري)">
        <div className="h-[300px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" />
              <YAxis />
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#fff", borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                labelStyle={{ color: "#64748b" }}
              />
              <Area type="monotone" dataKey="value" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="مصادر العملاء">
        <div className="h-[300px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={leadSourceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                contentStyle={{ backgroundColor: "#fff", borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                cursor={{ fill: "#f1f5f9" }}
              />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
