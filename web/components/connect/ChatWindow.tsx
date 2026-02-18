"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "../../lib/auth/AuthContext"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { conversationService } from "../../lib/services/conversationService"
import { Conversation, Message } from "../../lib/types"
import { Button } from "../ui/Button"
import { Card } from "../ui/Card"
import { Select } from "../ui/Select"
import { Textarea } from "../ui/Textarea"
import { Avatar } from "../ui/Avatar"
import { useTeams } from "../../lib/hooks/useTeams"
import { useUsers } from "../../lib/hooks/useUsers"

export const ChatWindow = () => {
  const { token, userId, role } = useAuth()
  const { dir } = useLocale()
  const { data: teams } = useTeams()
  const { data: users } = useUsers()
  
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [targetUserId, setTargetUserId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

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

  // Poll messages
  useEffect(() => {
    if (!activeId) return

    const loadMessages = async () => {
      try {
        const list = await conversationService.listMessages(activeId, token || undefined)
        setMessages(list)
      } catch (err) {
        console.error("Failed to load messages", err)
      }
    }
    
    loadMessages()
    const interval = setInterval(loadMessages, 3000) // Poll every 3 seconds for faster chat
    return () => clearInterval(interval)
  }, [activeId, token])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!activeId || !input.trim()) return
    try {
      const sent = await conversationService.sendMessage(
        activeId, 
        { content: input.trim(), contentType: "text" }, 
        token || undefined
      )
      setMessages((prev) => [sent, ...prev])
      setInput("")
      // Update conversation list preview
      setConversations(prev => prev.map(c => 
        c.id === activeId 
          ? { ...c, messages: [sent], lastMessageAt: new Date().toISOString() } 
          : c
      ).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()))
    } catch (err) {
      console.error(err)
      setError("فشل إرسال الرسالة")
      setTimeout(() => setError(null), 3000)
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-50/30">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-base-400 opacity-50">
                  <svg className="w-16 h-16 mb-4 text-base-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p>لا توجد رسائل بعد</p>
                </div>
              ) : (
                [...messages].reverse().map((message) => {
                  const isMine = message.senderId === userId
                  const sender = users?.find(u => u.id === message.senderId)
                  return (
                    <div key={message.id} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                      {!isMine && (
                        <Avatar 
                          size="xs" 
                          name={sender?.name || sender?.email || "?"} 
                          className="mb-1"
                        />
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        isMine 
                          ? "bg-brand-600 text-white rounded-br-none" 
                          : "bg-white text-base-900 border border-base-100 rounded-bl-none"
                      }`}>
                        {!isMine && (activeConversation?.type === "team_group" || activeConversation?.type === "owner_group") && (
                          <p className="text-[10px] font-bold text-brand-600 mb-1">{sender?.name || sender?.email}</p>
                        )}
                        <p className={textAlign}>{message.content}</p>
                        <span suppressHydrationWarning className={`text-[10px] block mt-1 opacity-70 ${textAlign}`}>
                          {new Date(message.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-base-100">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    className={`resize-none ${textAlign}`}
                    placeholder="اكتب رسالتك هنا..."
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
                  disabled={!input.trim()} 
                  className="rounded-xl px-4 h-[46px] aspect-square flex items-center justify-center"
                >
                  <svg className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
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
