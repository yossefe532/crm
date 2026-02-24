"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { leadService } from "../../../../lib/services/leadService"
import { coreService } from "../../../../lib/services/coreService"
import { useAuth } from "../../../../lib/auth/AuthContext"
import { useLeads } from "../../../../lib/hooks/useLeads"
import { Loader } from "../../../../components/ui/Loader"
import { Card } from "../../../../components/ui/Card"
import { Button } from "../../../../components/ui/Button"
import { Badge } from "../../../../components/ui/Badge"
import { useState, useMemo } from "react"
import { ConfirmationModal } from "../../../../components/ui/ConfirmationModal"
import { Trash2, CheckCircle2, XCircle, DollarSign, Calendar, Archive } from "lucide-react"

export default function ArchivePage() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"deleted" | "won" | "lost" | "finance">("deleted")
  const [restoringId, setRestoringId] = useState<string | null>(null)

  // 1. Deleted Leads
  const { data: deletedLeads, isLoading: isLoadingDeleted } = useQuery({
    queryKey: ["deletedLeads"],
    queryFn: () => leadService.listDeleted(token || undefined),
    enabled: !!token && activeTab === "deleted"
  })

  // 2. Won Leads
  const { data: wonLeads, isLoading: isLoadingWon } = useLeads({ status: "won" })

  // 3. Lost Leads
  const { data: lostLeads, isLoading: isLoadingLost } = useLeads({ status: "lost" })

  // 4. Finance Archive
  const { data: financeEntries, isLoading: isLoadingFinance } = useQuery({
    queryKey: ["finance_archive"],
    queryFn: () => coreService.listFinanceEntries(token || undefined),
    enabled: !!token && activeTab === "finance"
  })

  // Group Finance by Month
  const sortedFinanceGroups = useMemo(() => {
    if (!financeEntries) return []
    
    const groups: Record<string, typeof financeEntries> = {}
    
    financeEntries.forEach(entry => {
      const date = new Date(entry.occurredAt)
      // Use YYYY-MM as key for sorting
      const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!groups[sortKey]) groups[sortKey] = []
      groups[sortKey].push(entry)
    })
    
    // Sort keys descending (newest first)
    const sortedKeys = Object.keys(groups).sort().reverse()
    
    return sortedKeys.map(key => {
      const [year, month] = key.split('-').map(Number)
      const date = new Date(year, month - 1)
      const label = date.toLocaleDateString("ar-EG", { year: "numeric", month: "long" })
      
      // Sort entries within group by date descending
      const entries = groups[key].sort((a, b) => 
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      )
      
      return { key, label, entries }
    })
  }, [financeEntries])

  const restoreMutation = useMutation({
    mutationFn: (id: string) => leadService.restore(id, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deletedLeads"] })
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      setRestoringId(null)
    }
  })

  const tabs = [
    { id: "deleted", label: "المحذوفات", icon: Trash2, count: deletedLeads?.length },
    { id: "won", label: "الصفقات الناجحة", icon: CheckCircle2, count: wonLeads?.length },
    { id: "lost", label: "الصفقات الفاشلة", icon: XCircle, count: lostLeads?.length },
    { id: "finance", label: "أرشيف المالية", icon: DollarSign, count: financeEntries?.length }
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <Archive className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الأرشيف الشامل</h1>
          <p className="text-sm text-gray-500 mt-1">سجل كامل للعمليات السابقة والمحذوفات</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-base-200 pb-1">
        {tabs.map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === tab.id 
                    ? "text-brand-600" 
                    : "text-base-500 hover:text-base-700 hover:bg-base-50 rounded-t-lg"
                }`}
            >
                <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? "text-brand-600" : "text-base-400"}`} />
                {tab.label}
                {tab.count !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                        activeTab === tab.id ? "bg-brand-50 text-brand-700" : "bg-base-100 text-base-600"
                    }`}>
                        {tab.count}
                    </span>
                )}
                {activeTab === tab.id && (
                    <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-brand-600" />
                )}
            </button>
        ))}
      </div>

      {/* Content */}
      <Card className="overflow-hidden border border-base-200 shadow-sm min-h-[400px]">
        
        {/* DELETED TAB */}
        {activeTab === "deleted" && (
            <div className="overflow-x-auto">
                {isLoadingDeleted ? <Loader /> : (
                    <table className="w-full text-right text-sm">
                        <thead className="bg-base-50 text-xs uppercase text-base-500 font-medium border-b border-base-200">
                        <tr>
                            <th className="px-6 py-4">العميل</th>
                            <th className="px-6 py-4">الهاتف</th>
                            <th className="px-6 py-4">الحالة قبل الحذف</th>
                            <th className="px-6 py-4">تاريخ الحذف</th>
                            <th className="px-6 py-4">الإجراءات</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-base-100 bg-white">
                        {!deletedLeads || deletedLeads.length === 0 ? (
                            <EmptyState message="سلة المحذوفات فارغة" />
                        ) : (
                            deletedLeads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-base-50/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-base-900">{lead.name}</td>
                                <td className="px-6 py-4 text-base-600 dir-ltr text-right">{lead.phone}</td>
                                <td className="px-6 py-4">
                                <LeadStatusBadge status={lead.status} />
                                </td>
                                <td className="px-6 py-4 text-base-500 dir-ltr text-right">
                                {lead.deletedAt ? new Date(lead.deletedAt).toLocaleDateString("ar-EG") : "-"}
                                </td>
                                <td className="px-6 py-4">
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setRestoringId(lead.id)}
                                    disabled={restoreMutation.isPending}
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                >
                                    استعادة
                                </Button>
                                </td>
                            </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                )}
            </div>
        )}

        {/* WON TAB */}
        {activeTab === "won" && (
            <div className="overflow-x-auto">
                {isLoadingWon ? <Loader /> : (
                    <table className="w-full text-right text-sm">
                        <thead className="bg-emerald-50 text-xs uppercase text-emerald-800 font-medium border-b border-emerald-100">
                        <tr>
                            <th className="px-6 py-4">العميل</th>
                            <th className="px-6 py-4">الهاتف</th>
                            <th className="px-6 py-4">قيمة الصفقة</th>
                            <th className="px-6 py-4">تاريخ الإغلاق</th>
                            <th className="px-6 py-4">المسؤول</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-base-100 bg-white">
                        {!wonLeads || wonLeads.length === 0 ? (
                            <EmptyState message="لا توجد صفقات ناجحة مؤرشفة" />
                        ) : (
                            wonLeads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-base-50/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-base-900">{lead.name}</td>
                                <td className="px-6 py-4 text-base-600 dir-ltr text-right">{lead.phone}</td>
                                <td className="px-6 py-4 font-bold text-emerald-600">
                                    {/* Need to fetch deal value if available, likely in lead properties or separate query */}
                                    {lead.budgetMin ? `${lead.budgetMin.toLocaleString()} ج.م` : "-"}
                                </td>
                                <td className="px-6 py-4 text-base-500">
                                    {/* UpdatedAt is best proxy for now if closedAt not available on Lead type directly */}
                                    {new Date(lead.updatedAt).toLocaleDateString("ar-EG")}
                                </td>
                                <td className="px-6 py-4">
                                    {lead.assignedUserId ? "بواسطة عضو فريق" : "-"}
                                </td>
                            </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                )}
            </div>
        )}

        {/* LOST TAB */}
        {activeTab === "lost" && (
            <div className="overflow-x-auto">
                {isLoadingLost ? <Loader /> : (
                    <table className="w-full text-right text-sm">
                        <thead className="bg-rose-50 text-xs uppercase text-rose-800 font-medium border-b border-rose-100">
                        <tr>
                            <th className="px-6 py-4">العميل</th>
                            <th className="px-6 py-4">الهاتف</th>
                            <th className="px-6 py-4">سبب الخسارة</th>
                            <th className="px-6 py-4">تاريخ الخسارة</th>
                            <th className="px-6 py-4">المسؤول</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-base-100 bg-white">
                        {!lostLeads || lostLeads.length === 0 ? (
                            <EmptyState message="لا توجد صفقات فاشلة مؤرشفة" />
                        ) : (
                            lostLeads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-base-50/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-base-900">{lead.name}</td>
                                <td className="px-6 py-4 text-base-600 dir-ltr text-right">{lead.phone}</td>
                                <td className="px-6 py-4 text-rose-600">
                                    {lead.notes || "-"}
                                </td>
                                <td className="px-6 py-4 text-base-500">
                                    {new Date(lead.updatedAt).toLocaleDateString("ar-EG")}
                                </td>
                                <td className="px-6 py-4">
                                    {lead.assignedUserId ? "بواسطة عضو فريق" : "-"}
                                </td>
                            </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                )}
            </div>
        )}

        {/* FINANCE TAB */}
        {activeTab === "finance" && (
            <div className="p-6">
                {isLoadingFinance ? <Loader /> : (
                    <div className="space-y-8">
                        {(!financeEntries || financeEntries.length === 0) && (
                            <EmptyState message="لا توجد سجلات مالية مؤرشفة" asRow={false} />
                        )}
                        
                        {sortedFinanceGroups.map(group => (
                            <div key={group.key} className="border border-base-200 rounded-lg overflow-hidden">
                                <div className="bg-base-50 px-4 py-3 border-b border-base-200 flex justify-between items-center">
                                    <h3 className="font-bold text-base-900 flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-base-500" />
                                        {group.label}
                                    </h3>
                                    <span className="text-xs font-medium bg-white px-2 py-1 rounded border border-base-200">
                                        {group.entries.length} عملية
                                    </span>
                                </div>
                                <div className="divide-y divide-base-100">
                                    {group.entries.map(entry => (
                                        <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-base-50/50">
                                            <div>
                                                <p className="font-medium text-base-900">{entry.category}</p>
                                                <p className="text-xs text-base-500">{entry.note || "بدون ملاحظات"}</p>
                                            </div>
                                            <div className="text-left">
                                                <p className={`font-bold ${entry.entryType === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {entry.entryType === 'income' ? '+' : '-'}{entry.amount.toLocaleString()} ج.م
                                                </p>
                                                <p className="text-xs text-base-400">
                                                    {new Date(entry.occurredAt).toLocaleDateString("ar-EG")}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

      </Card>

      <ConfirmationModal
        isOpen={!!restoringId}
        onClose={() => setRestoringId(null)}
        onConfirm={() => restoringId && restoreMutation.mutate(restoringId)}
        title="تأكيد الاستعادة"
        description="هل أنت متأكد من استعادة هذا العميل؟ سيتم إرجاعه إلى قائمة العملاء النشطة."
        confirmText="نعم، استعادة"
        cancelText="إلغاء"
        variant="info"
      />
    </div>
  )
}

function EmptyState({ message, asRow = true }: { message: string, asRow?: boolean }) {
    const content = (
        <div className="flex flex-col items-center justify-center gap-2 text-base-400 w-full py-12">
            <Archive className="h-10 w-10 opacity-20" />
            <p>{message}</p>
        </div>
    )

    if (asRow) {
        return (
            <tr>
                <td colSpan={5} className="px-6 text-center w-full">
                    {content}
                </td>
            </tr>
        )
    }
    return content
}

function LeadStatusBadge({ status }: { status: string }) {
    return (
        <Badge tone={
            status === "won" ? "success" : 
            status === "lost" ? "danger" : 
            status === "new" ? "info" : "default"
        }>
            {status === "new" ? "جديد" : 
             status === "won" ? "صفقة ناجحة" : 
             status === "lost" ? "صفقة فاشلة" : status}
        </Badge>
    )
}