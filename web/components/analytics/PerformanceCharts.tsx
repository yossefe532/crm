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
import { useFinanceEntries } from "../../lib/hooks/useFinanceEntries"
import { useLeads } from "../../lib/hooks/useLeads"
import { useUsers } from "../../lib/hooks/useUsers"
import { useMemo } from "react"

export const PerformanceCharts = () => {
  const { data, isLoading, isError } = useDashboardAnalytics()
  const { data: financeEntries } = useFinanceEntries()
  const { data: leads } = useLeads()
  const { data: users } = useUsers()

  const revenueData = useMemo(() => {
    if (!financeEntries || financeEntries.length === 0) return data?.revenueOverTime || []
    
    // Group by month (last 6 months for example, or all available)
    const monthlyData = new Map<string, number>()
    const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    
    financeEntries.forEach(entry => {
      // Only count income for "Total Revenue"
      if (entry.entryType === 'income') {
        const date = new Date(entry.occurredAt)
        const monthName = months[date.getMonth()]
        const current = monthlyData.get(monthName) || 0
        monthlyData.set(monthName, current + entry.amount)
      }
    })

    return Array.from(monthlyData.entries()).map(([name, value]) => ({ name, value }))
  }, [financeEntries, data?.revenueOverTime])

  const leadSourceData = useMemo(() => {
    if ((!leads || leads.length === 0) && (!data?.leadSources || data.leadSources.length === 0)) return []
    if (!leads) return data?.leadSources || []
    
    const userMap = new Map(users?.map(u => [u.id, u.name || "مستخدم"]) || [])
    const sourceCount = new Map<string, number>()
    
    leads.forEach(lead => {
      const assigneeName = lead.assignedUserId ? userMap.get(lead.assignedUserId) : "غير معين"
      const name = assigneeName || "غير معروف"
      sourceCount.set(name, (sourceCount.get(name) || 0) + 1)
    })
    
    return Array.from(sourceCount.entries()).map(([name, value]) => ({ name, value }))
  }, [leads, users, data?.leadSources])


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
          <div className="h-[300px] w-full flex items-center justify-center text-sm text-rose-600">تعذر تحميل البيانات</div>
        </Card>
        <Card>
          <div className="h-[300px] w-full flex items-center justify-center text-sm text-rose-600">تعذر تحميل البيانات</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="إجمالي الإيرادات (شهري)">
        <div className="h-[300px] w-full" dir="ltr">
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(var(--brand-500))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="rgb(var(--brand-500))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="rgb(var(--base-500))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgb(var(--base-500))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--base-200))" />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: "rgb(var(--base-0))", 
                    borderRadius: "8px", 
                    border: "1px solid rgb(var(--base-200))", 
                    boxShadow: "var(--shadow-card)",
                    color: "rgb(var(--base-900))"
                  }}
                  itemStyle={{ color: "rgb(var(--brand-600))" }}
                  labelStyle={{ color: "rgb(var(--base-500))", marginBottom: "0.5rem" }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="rgb(var(--brand-600))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  activeDot={{ r: 6, strokeWidth: 0, fill: "rgb(var(--brand-600))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-base-400">
              <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              <p>لا توجد بيانات إيرادات متاحة</p>
            </div>
          )}
        </div>
      </Card>

      <Card title="مصادر العملاء">
        <div className="h-[300px] w-full" dir="ltr">
          {leadSourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadSourceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--base-200))" />
                <XAxis dataKey="name" stroke="rgb(var(--base-500))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgb(var(--base-500))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: "rgb(var(--base-0))", 
                    borderRadius: "8px", 
                    border: "1px solid rgb(var(--base-200))", 
                    boxShadow: "var(--shadow-card)",
                    color: "rgb(var(--base-900))"
                  }}
                  cursor={{ fill: "rgb(var(--base-100))" }}
                  labelStyle={{ color: "rgb(var(--base-500))", marginBottom: "0.5rem" }}
                />
                <Bar dataKey="value" fill="rgb(var(--brand-500))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-base-400">
              <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <p>لا توجد بيانات عملاء متاحة</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
