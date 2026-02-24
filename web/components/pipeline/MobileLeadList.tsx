"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useAuth } from "../../lib/auth/AuthContext"
import { leadService } from "../../lib/services/leadService"
import { Lead } from "../../lib/types"
import { Badge } from "../ui/Badge"

const stageLabels: Record<string, string> = {
  new: "جديد",
  call: "مكالمة هاتفية",
  meeting: "اجتماع",
  site_visit: "رؤية الموقع",
  closing: "إغلاق الصفقة"
}

export const MobileLeadList = ({ leads }: { leads: Lead[] }) => {
  const { role, token } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadService.delete(id, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    }
  })

  if (!leads?.length) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-base-200 bg-base-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-base-100">
          <svg className="h-6 w-6 text-base-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-base-900">لا يوجد عملاء</h3>
        <p className="mt-1 text-sm text-base-500">لم يتم العثور على عملاء مطابقين للبحث.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-20">
      {leads.map((lead) => (
        <div key={lead.id} className="relative flex flex-col gap-3 rounded-xl border border-base-200 bg-white p-4 shadow-sm transition-all active:scale-[0.99]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base-900 text-lg truncate">{lead.name}</h3>
                {lead.priority === "high" && <span className="h-2 w-2 rounded-full bg-red-500" title="أولوية عالية" />}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-base-500">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="truncate dir-ltr">{lead.phone || "لا يوجد هاتف"}</span>
              </div>
              
              {lead.leadCode && (
                <div className="mt-1 flex items-center gap-2 text-xs text-base-400">
                  <span>#{lead.leadCode}</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <Badge variant={lead.status === 'new' ? 'default' : 'outline'} className="whitespace-nowrap">
                {stageLabels[lead.status] || lead.status}
              </Badge>
              {lead.assignedUserId && (
                <span className="text-[10px] bg-base-100 px-1.5 py-0.5 rounded text-base-600">
                  مسند
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-base-100 pt-3 mt-1">
            <div className="flex gap-2">
                {lead.sourceLabel && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    {lead.sourceLabel}
                    </span>
                )}
            </div>
            
            <div className="flex items-center gap-2">
              {role === "owner" && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm("هل أنت متأكد من نقل هذا العميل إلى سلة المهملات؟")) {
                      deleteMutation.mutate(lead.id)
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition-colors hover:bg-red-100 active:bg-red-200"
                  title="نقل للمهملات"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/leads/${lead.id}`)
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-colors hover:bg-brand-100 active:bg-brand-200"
                title="تفاصيل العميل"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
