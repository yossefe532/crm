"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Modal } from "./Modal"
import { Input } from "./Input"
import { useLeads } from "../../lib/hooks/useLeads"
import { useUsers } from "../../lib/hooks/useUsers"
import { useDebounce } from "../../lib/hooks/useDebounce"
import { Avatar } from "./Avatar"
import { Badge } from "./Badge"

export const GlobalSearch = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)
  const router = useRouter()

  // Queries
  const { data: leads, isLoading: leadsLoading } = useLeads({ query: debouncedSearch })
  const { data: users } = useUsers()

  // Filter Users (client-side as useUsers usually returns all)
  const filteredUsers = useMemo(() => {
    if (!debouncedSearch || !users) return []
    const term = debouncedSearch.toLowerCase()
    return users.filter(u => 
      (u.name || "").toLowerCase().includes(term) || 
      (u.email || "").toLowerCase().includes(term)
    ).slice(0, 5)
  }, [debouncedSearch, users])

  // Filter Pages (Static)
  const pages = [
    { name: "الرئيسية", href: "/owner" },
    { name: "قناة العملاء", href: "/pipeline" },
    { name: "المالية", href: "/finance" },
    { name: "الطلبات", href: "/requests" },
    { name: "الإعدادات", href: "/settings/users" },
    { name: "التواصل", href: "/connect" },
  ]
  
  const filteredPages = useMemo(() => {
    if (!debouncedSearch) return []
    const term = debouncedSearch.toLowerCase()
    return pages.filter(p => p.name.includes(term))
  }, [debouncedSearch])

  // Reset on close
  useEffect(() => {
    if (!isOpen) setSearch("")
  }, [isOpen])

  // Navigation Handler
  const handleNavigate = (href: string) => {
    setIsOpen(false)
    router.push(href)
  }

  // Keyboard shortcut (Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-base-500 bg-base-100 hover:bg-base-200 rounded-lg transition-colors border border-transparent hover:border-base-300 w-full md:w-64"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span className="hidden md:inline">بحث سريع...</span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-base-0 px-1.5 font-mono text-[10px] font-medium text-base-400 ml-auto">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="البحث الشامل" size="lg">
        <div className="space-y-4 min-h-[300px]">
          <Input 
            autoFocus
            placeholder="ابحث عن عملاء، موظفين، أو صفحات..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="text-lg py-3"
          />

          <div className="space-y-6">
            {/* Pages Section */}
            {filteredPages.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-base-500 uppercase mb-2">الصفحات</h4>
                <div className="space-y-1">
                  {filteredPages.map(page => (
                    <button
                      key={page.href}
                      onClick={() => handleNavigate(page.href)}
                      className="flex items-center w-full px-3 py-2 text-sm text-base-700 rounded-lg hover:bg-base-100 transition-colors"
                    >
                      <span className="w-5 h-5 flex items-center justify-center mr-2 text-base-400">📄</span>
                      {page.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Users Section */}
            {filteredUsers.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-base-500 uppercase mb-2">الموظفين</h4>
                <div className="space-y-1">
                  {filteredUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleNavigate(`/settings/users?id=${user.id}`)} // Assuming this link or similar
                      className="flex items-center w-full px-3 py-2 text-sm text-base-700 rounded-lg hover:bg-base-100 transition-colors"
                    >
                      <Avatar name={user.name} className="w-6 h-6 mr-2 ml-2" />
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-base-400">{user.email}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Leads Section */}
            {search && (
              <div>
                <h4 className="text-xs font-semibold text-base-500 uppercase mb-2">العملاء</h4>
                {leadsLoading ? (
                  <div className="p-4 text-center text-sm text-base-400">جاري البحث...</div>
                ) : (leads || []).length > 0 ? (
                  <div className="space-y-1">
                    {(leads || []).slice(0, 5).map(lead => (
                      <button
                        key={lead.id}
                        onClick={() => handleNavigate(`/leads/${lead.id}`)}
                        className="flex items-center w-full px-3 py-2 text-sm text-base-700 rounded-lg hover:bg-base-100 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center ml-3 group-hover:bg-brand-100 transition-colors">
                          {lead.name.charAt(0)}
                        </div>
                        <div className="flex-1 text-right">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-base-900">{lead.name}</span>
                            {lead.leadCode && <Badge variant="outline" className="text-[10px] px-1 h-5">#{lead.leadCode}</Badge>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-base-500 mt-0.5">
                            <span>{lead.phone || "بدون هاتف"}</span>
                            {lead.status && (
                              <span className="px-1.5 py-0.5 rounded bg-base-100 text-base-600">
                                {lead.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 text-sm text-base-400">لا توجد نتائج</div>
                )}
              </div>
            )}
          </div>
          
          {!search && (
            <div className="flex flex-col items-center justify-center py-12 text-base-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-20"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <p>اكتب للبحث...</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
