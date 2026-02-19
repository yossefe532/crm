"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "../../lib/auth/AuthContext"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { conversationService } from "../../lib/services/conversationService"
import { notificationService } from "../../lib/services/notificationService"
import { useSearchParams } from "next/navigation"
import { Conversation, Message } from "../../lib/types"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { Select } from "../ui/Select"
import { Textarea } from "../ui/Textarea"
import { Avatar } from "../ui/Avatar"
import { useTeams } from "../../lib/hooks/useTeams"
import { useUsers } from "../../lib/hooks/useUsers"

// Extend Message type for local state
type LocalMessage = Message & {
  status?: 'pending' | 'sent' | 'error'
}

export const ChatWindow = () => {
  const { token, userId, role } = useAuth()
  const { dir } = useLocale()
  const searchParams = useSearchParams()
  const { data: teams } = useTeams()
  const { data: users } = useUsers()
  
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [input, setInput] = useState("")
  const [targetUserId, setTargetUserId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSending, setIsSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textAlign = dir === "rtl" ? "text-right" : "text-left"

  const teamById = useMemo(() => new Map((teams || []).map((team) => [team.id, team.name])), [teams])

  // Initial load
  useEffect(() => {
    const load = async () => {
      try {
        const list = await conversationService.list(token || undefined)
        setConversations(list)
        if (!activeId && list.length > 0) {
          setActiveId(list[0].id)
        }
      } catch (err) {
        console.error("Failed to load conversations", err)
      }
    }
    load()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep link support to open/create conversation
  useEffect(() => {
    const uid = searchParams.get("userId")
    const teamId = searchParams.get("teamId")
    const ownerGroup = searchParams.get("ownerGroup")
    const open = async () => {
      try {
        if (uid) {
          const conv = await conversationService.createDirect(uid, token || undefined)
          setActiveId(conv.id)
          setConversations(prev => {
            const exists = prev.find(c => c.id === conv.id)
            return exists ? prev : [conv, ...prev]
          })
        } else if (teamId) {
          const conv = await conversationService.createTeamGroup(teamId, token || undefined)
          setActiveId(conv.id)
          setConversations(prev => {
            const exists = prev.find(c => c.id === conv.id)
            return exists ? prev : [conv, ...prev]
          })
        } else if (ownerGroup) {
          const conv = await conversationService.getOwnerGroup(token || undefined)
          setActiveId(conv.id)
          setConversations(prev => {
            const exists = prev.find(c => c.id === conv.id)
            return exists ? prev : [conv, ...prev]
          })
        }
      } catch {
        // ignore
      }
    }
    open()
  }, [searchParams, token])

  // Poll messages
  useEffect(() => {
    if (!activeId) return

    const loadMessages = async () => {
      try {
        const serverMessages = await conversationService.listMessages(activeId, token || undefined)
        
        setMessages(prev => {
          // Keep pending messages that are not in the server list yet
          const pending = prev.filter(m => m.status === 'pending')
          
          const serverIds = new Set(serverMessages.map(m => m.id))
          const uniquePending = pending.filter(p => !serverIds.has(p.id)) // Pending IDs are temp-*, so this works
          
          return [...serverMessages, ...uniquePending]
        })
        
        // mark last seen for unread tracking
        try {
          const key = `chat:lastSeen:${activeId}`
          localStorage.setItem(key, new Date().toISOString())
        } catch {}
      } catch (err) {
        console.error("Failed to load messages", err)
      }
    }
    
    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [activeId, token])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, activeId])

  const handleSend = async () => {
    if (!activeId || !input.trim() || isSending) return
    
    const content = input.trim()
    setInput("") // Clear immediately to prevent double send
    setIsSending(true)

    const tempId = `temp-${Date.now()}`
    const optimistic: LocalMessage = {
      id: tempId,
      conversationId: activeId,
      senderId: userId || "",
      content: content,
      contentType: "text",
      createdAt: new Date().toISOString(),
      status: 'pending'
    }

    // Add optimistic message
    setMessages((prev) => [...prev, optimistic])

    try {
      const sent = await conversationService.sendMessage(
        activeId, 
        { content, contentType: "text" }, 
        token || undefined
      )
      
      // Replace optimistic with real
      setMessages((prev) => 
        prev.map(m => m.id === tempId ? { ...sent, status: 'sent' } : m)
      )

      // Update conversation list preview
      setConversations(prev => prev.map(c => 
        c.id === activeId 
          ? { ...c, messages: [sent], lastMessageAt: new Date().toISOString() } 
          : c
      ).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()))
      
      // Push notify other participants
      try {
        const conv = conversations.find(c => c.id === activeId)
        if (conv) {
          if (conv.type === "direct" && conv.participants) {
            const other = conv.participants.find(p => p.userId !== userId)
            if (other?.userId) {
              await notificationService.broadcast(
                { type: "user", value: other.userId },
                `CHAT_MESSAGE: ${sent.content || ""}`,
                ["push"],
                token || undefined
              )
            }
          } else if (conv.type === "team_group" && conv.entityId) {
            await notificationService.broadcast(
              { type: "team", value: conv.entityId },
              `CHAT_MESSAGE: ${sent.content || ""}`,
              ["push"],
              token || undefined
            )
          } else if (conv.type === "owner_group") {
            await notificationService.broadcast(
              { type: "role", value: "owner" },
              `CHAT_MESSAGE: ${sent.content || ""}`,
              ["push"],
              token || undefined
            )
          }
        }
      } catch {}
    } catch (err) {
      console.error(err)
      setError("فشل إرسال الرسالة")
      setMessages((prev) => 
        prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m)
      )
      setTimeout(() => setError(null), 2000)
    } finally {
      setIsSending(false)
    }
  }

  const handleStartDirect = async () => {
    if (!targetUserId) return
    try {
      const convo = await conversationService.createDirect(targetUserId, token || undefined)
      setConversations((prev) => {
        if (prev.some((item) => item.id === convo.id)) return prev
        return [convo, ...prev]
      })
      setActiveId(convo.id)
      try {
        const list = await conversationService.listMessages(convo.id, token || undefined)
        setMessages(list)
      } catch (err) {
        console.error("Failed to load messages after creating direct", err)
      }
      setTargetUserId("")
      setError(null)
      setIsSidebarOpen(false) // Close sidebar on mobile
    } catch {
      setError("تعذر بدء المحادثة")
    }
  }

  const allowedUsers = useMemo(() => {
    const list = (users || []).filter((user) => user.id !== userId)
    if (role === "owner") return list
    
    // Team Leader: Can message Owners + Their Team Members + Other Team Leaders (optional, let's stick to request)
    if (role === "team_leader") {
      const myTeams = (teams || []).filter((team) => team.leaderUserId === userId)
      const memberIds = new Set(myTeams.flatMap(t => (t.members || []).map(m => m.userId)))
      
      return list.filter((user) => {
        const isOwner = (user.roles || []).includes("owner")
        const isMyTeamMember = memberIds.has(user.id)
        return isOwner || isMyTeamMember
      })
    }
    
    // Sales: Can message Owners + Their Team Leader + Team Colleagues
    if (role === "sales") {
      const myTeam = (teams || []).find((team) => (team.members || []).some((member) => member.userId === userId))
      const leaderId = myTeam?.leaderUserId
      const colleagueIds = new Set((myTeam?.members || []).map(m => m.userId))
      
      return list.filter((user) => {
        const isOwner = (user.roles || []).includes("owner")
        const isLeader = leaderId ? user.id === leaderId : false
        const isColleague = colleagueIds.has(user.id)
        return isOwner || isLeader || isColleague
      })
    }
    return []
  }, [role, teams, userId, users])

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.type === "direct") {
      const other = (conversation.participants || []).find((p) => p.userId !== userId)
      const profileName = other?.user?.profile?.firstName
        ? `${other?.user?.profile?.firstName}${other?.user?.profile?.lastName ? ` ${other?.user?.profile?.lastName}` : ""}`
        : undefined
      return other?.user?.name || profileName || other?.user?.email || "محادثة مباشرة"
    }
    if (conversation.type === "team_group") {
      if (conversation.entityId && teamById.has(conversation.entityId)) {
        return `فريق ${teamById.get(conversation.entityId)}`
      }
      return "مجموعة الفريق"
    }
    if (conversation.type === "owner_group") {
      return "مجموعة قادة الفرق"
    }
    return "محادثة"
  }

  const groups = conversations.filter(c => c.type !== "direct")
  const directs = conversations.filter(c => c.type === "direct")
  const activeConversation = conversations.find(c => c.id === activeId)

  return (
    <div className="flex h-[calc(100dvh-140px)] gap-4 overflow-hidden rounded-xl bg-base-0 shadow-sm border border-base-200">
      {/* Sidebar */}
      <div className={`flex w-full flex-col border-l border-base-100 bg-base-50/50 md:w-80 ${isSidebarOpen ? "block" : "hidden md:flex"}`}>
        <div className="p-4 border-b border-base-100">
          <h2 className="text-lg font-bold text-base-900 mb-4">الرسائل</h2>
          
          {/* New Chat */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select
                className="flex-1 text-right"
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
              >
                <option value="">محادثة جديدة...</option>
                {allowedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </Select>
              <Button size="sm" disabled={!targetUserId} onClick={handleStartDirect} className="px-3">
                بدء
              </Button>
            </div>
            {role !== "owner" && (
              <div className="flex">
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const convo = await conversationService.getOwnerGroup(token || undefined)
                      setConversations((prev) => {
                        if (prev.some((item) => item.id === convo.id)) return prev
                        return [convo, ...prev]
                      })
                      setActiveId(convo.id)
                      setIsSidebarOpen(false)
                    } catch {
                      setError("تعذر فتح مجموعة المالك")
                    }
                  }}
                  className="px-3"
                >
                  فتح مجموعة المالك
                </Button>
              </div>
            )}
            {error && <p className="text-xs text-rose-500">{error}</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Groups */}
          {groups.length > 0 && (
            <div className="space-y-1">
              <p className="px-2 text-xs font-bold text-base-400 uppercase tracking-wider">المجموعات</p>
              {groups.map((conversation) => (
                <Button
                  key={conversation.id}
                  variant="ghost"
                  onClick={() => {
                    setActiveId(conversation.id)
                    setIsSidebarOpen(false)
                  }}
                  className={`w-full justify-start gap-3 px-3 py-2 text-sm font-normal ${
                    activeId === conversation.id 
                      ? "bg-brand-50 text-brand-700 font-medium shadow-sm hover:bg-brand-100" 
                      : "hover:bg-base-100 text-base-700"
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    activeId === conversation.id ? "bg-brand-100 text-brand-600" : "bg-base-200 text-base-500"
                  }`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="truncate">{getConversationTitle(conversation)}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Directs */}
          <div className="space-y-1">
            <p className="px-2 text-xs font-bold text-base-400 uppercase tracking-wider">الرسائل المباشرة</p>
            {directs.map((conversation) => (
              <Button
                key={conversation.id}
                variant="ghost"
                onClick={() => {
                  setActiveId(conversation.id)
                  setIsSidebarOpen(false)
                }}
                className={`w-full h-auto justify-start gap-3 px-3 py-2 text-sm font-normal ${
                  activeId === conversation.id 
                    ? "bg-brand-50 text-brand-700 font-medium shadow-sm hover:bg-brand-100" 
                    : "hover:bg-base-100 text-base-700"
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  activeId === conversation.id ? "bg-brand-100 text-brand-600" : "bg-base-200 text-base-500"
                }`}>
                  <span className="text-xs font-bold">
                    {getConversationTitle(conversation).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col items-start overflow-hidden flex-1">
                  <span className="truncate w-full text-right">{getConversationTitle(conversation)}</span>
                  <span className={`truncate w-full text-right text-xs ${activeId === conversation.id ? "text-brand-500/80" : "text-base-400"}`}>
                    {conversation.messages?.[0]?.content || "لا توجد رسائل"}
                  </span>
                </div>
              </Button>
            ))}
            {directs.length === 0 && <p className="px-3 text-xs text-base-400">لا توجد محادثات</p>}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex flex-1 flex-col ${!isSidebarOpen ? "block" : "hidden md:flex"}`}>
        {activeId ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-base-100 p-4 bg-white/50 backdrop-blur-sm">
              <Button 
                variant="ghost"
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-1 rounded-lg hover:bg-base-100 text-base-500 h-auto"
              >
                <svg className={`w-6 h-6 ${dir === 'rtl' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
              <div className="flex-1">
                <h3 className="font-bold text-base-900">
                  {getConversationTitle(conversations.find(c => c.id === activeId)!)}
                </h3>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#e5ddd5] dark:bg-[#0b141a]" style={{ backgroundImage: "url('/chat-bg.png')", backgroundBlendMode: 'overlay' }}>
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-gray-500 opacity-70">
                  <div className="bg-white/50 p-4 rounded-full mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="bg-white/50 px-3 py-1 rounded-lg text-sm shadow-sm">ابدأ المحادثة الآن</p>
                </div>
              ) : (
                [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((message) => {
                  const isMine = message.senderId === userId
                  const sender = users?.find(u => u.id === message.senderId)
                  
                  // Status Icon
                  const StatusIcon = () => {
                    if (!isMine) return null
                    if (message.status === 'error') return <span className="text-red-500 text-xs">!</span>
                    if (message.status === 'pending') return (
                      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )
                    // Sent (Check)
                    return (
                      <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )
                  }

                  return (
                    <div key={message.id} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                      {!isMine && (activeConversation?.type !== "direct") && (
                        <Avatar 
                          size="xs" 
                          name={sender?.name || sender?.email || "?"} 
                          className="mb-1"
                        />
                      )}
                      <div className={`relative max-w-[75%] px-3 py-2 text-sm shadow-sm ${
                        isMine 
                          ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-white rounded-2xl rounded-tr-none" 
                          : "bg-white dark:bg-[#202c33] text-gray-900 dark:text-white rounded-2xl rounded-tl-none"
                      }`}>
                        {!isMine && (activeConversation?.type === "team_group" || activeConversation?.type === "owner_group") && (
                          <p className={`text-[11px] font-bold mb-1 ${
                             ['text-orange-500', 'text-blue-500', 'text-purple-500', 'text-green-500'][((sender?.name?.length || 0) % 4)]
                          }`}>
                            {sender?.name || sender?.email}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-end gap-2">
                          <p className={`whitespace-pre-wrap leading-relaxed ${textAlign} min-w-[60px]`}>{message.content}</p>
                          <div className="flex items-center gap-1 opacity-60 shrink-0 ml-auto select-none">
                            <span className="text-[10px] min-w-fit">
                              {new Date(message.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                            <StatusIcon />
                          </div>
                        </div>
                        
                        {/* Triangle for bubble tail */}
                        <div className={`absolute top-0 w-0 h-0 border-[6px] border-transparent ${
                           isMine 
                            ? "-right-[6px] border-t-[#d9fdd3] dark:border-t-[#005c4b] border-r-0" 
                            : "-left-[6px] border-t-white dark:border-t-[#202c33] border-l-0"
                        }`} />
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                {/* Attachment Button (Visual) */}
                <Button variant="ghost" className="rounded-full w-10 h-10 p-0 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                   </svg>
                </Button>

                <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-2xl flex items-center px-4 py-2 shadow-sm border border-transparent focus-within:border-brand-500 transition-all">
                  <Textarea
                    className={`flex-1 bg-transparent border-none focus:ring-0 p-0 min-h-[24px] max-h-[120px] resize-none ${textAlign} placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white`}
                    placeholder="اكتب رسالة..."
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = e.target.value ? `${Math.min(e.target.scrollHeight, 120)}px` : 'auto'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                  />
                </div>
                
                <Button 
                  onClick={handleSend} 
                  disabled={!input.trim() || isSending} 
                  className={`rounded-full w-10 h-10 p-0 flex items-center justify-center transition-all ${
                    input.trim() 
                      ? "bg-[#00a884] hover:bg-[#008f6f] text-white shadow-md transform scale-100" 
                      : "bg-gray-300 dark:bg-gray-600 text-gray-500 scale-95"
                  }`}
                >
                  {isSending ? (
                     <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                  ) : (
                    <svg className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''} translate-x-[2px]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-base-400 bg-base-50/30">
            <div className="h-20 w-20 rounded-full bg-base-100 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-base-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="font-medium text-lg text-base-600">اختر محادثة للبدء</p>
            <p className="text-sm mt-2">يمكنك التواصل مع فريقك والعملاء من هنا</p>
          </div>
        )}
      </div>
    </div>
  )
}
