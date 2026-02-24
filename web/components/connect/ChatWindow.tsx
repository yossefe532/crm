"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "../../lib/auth/AuthContext"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { conversationService } from "../../lib/services/conversationService"
import { notificationService } from "../../lib/services/notificationService"
import { useSearchParams } from "next/navigation"
import { Conversation, Message, User } from "../../lib/types"
import { Button } from "../ui/Button"
import { Select } from "../ui/Select"
import { Textarea } from "../ui/Textarea"
import { Avatar } from "../ui/Avatar"
import { Modal } from "../ui/Modal"
import { Input } from "../ui/Input"
import { Checkbox } from "../ui/Checkbox"
import { useTeams } from "../../lib/hooks/useTeams"
import { useUsers } from "../../lib/hooks/useUsers"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSocket } from "../../lib/hooks/useSocket"
import { formatDistanceToNow, isSameDay, isYesterday, format } from "date-fns"
import { ar } from "date-fns/locale"

// Extend Message type for local state
type LocalMessage = Message & {
  status?: 'pending' | 'sent' | 'error'
}

const MessageStatusIcon = ({ status, isRead }: { status?: 'pending' | 'sent' | 'error', isRead?: boolean }) => {
    if (status === 'pending') {
        return <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    }
    if (status === 'error') {
        return <span className="text-red-500 text-xs">!</span>
    }
    if (isRead) {
        // Blue Double Check
        return (
            <div className="relative w-4 h-3">
                 <svg className="w-4 h-4 text-blue-500 absolute top-[-2px] right-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                 <svg className="w-4 h-4 text-blue-500 absolute top-[-2px] right-[6px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
        )
    }
    // Gray Double Check (Delivered)
    return (
        <div className="relative w-4 h-3">
             <svg className="w-4 h-4 text-gray-400 absolute top-[-2px] right-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             <svg className="w-4 h-4 text-gray-400 absolute top-[-2px] right-[6px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
    )
}

export const ChatWindow = () => {
  const { token, userId, role } = useAuth()
  const { dir } = useLocale()
  const searchParams = useSearchParams()
  const { data: teams } = useTeams()
  const { data: users } = useUsers()
  const socket = useSocket()
  const queryClient = useQueryClient()
  
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [targetUserId, setTargetUserId] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Group Creation State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [groupTitle, setGroupTitle] = useState("")
  const [groupParticipants, setGroupParticipants] = useState<string[]>([])
  
  // Group Info State
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false)
  const [memberToAdd, setMemberToAdd] = useState("")

  // Edit Message State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")

  // Reply State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)

  // Typing State
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textAlign = dir === "rtl" ? "text-right" : "text-left"

  const teamById = useMemo(() => new Map((teams || []).map((team) => [team.id, team.name])), [teams])

  // Queries
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
        const data = await conversationService.list(token || undefined)
        if (typeof window !== 'undefined') {
            localStorage.setItem('cached_conversations', JSON.stringify(data))
        }
        return data
    },
    initialData: () => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('cached_conversations')
            if (cached) {
                try {
                    return JSON.parse(cached)
                } catch (e) {
                    return []
                }
            }
        }
        return []
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5 // 5 minutes
  })

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ['messages', activeId],
    queryFn: async () => {
        const data = await conversationService.listMessages(activeId!, token || undefined)
        if (typeof window !== 'undefined' && activeId) {
            localStorage.setItem(`cached_messages_${activeId}`, JSON.stringify(data))
        }
        return data
    },
    initialData: () => {
        if (typeof window !== 'undefined' && activeId) {
            const cached = localStorage.getItem(`cached_messages_${activeId}`)
            if (cached) {
                try {
                    return JSON.parse(cached)
                } catch (e) {
                    return []
                }
            }
        }
        return []
    },
    enabled: !!activeId && !!token,
    staleTime: Infinity // We rely on socket updates
  })

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, replyToId }: { content: string, replyToId?: string, replyContext?: Message }) => {
      return conversationService.sendMessage(activeId!, { content, contentType: "text", replyToId }, token || undefined)
    },
    onMutate: async ({ content, replyContext }) => {
      await queryClient.cancelQueries({ queryKey: ['messages', activeId] })
      const previousMessages = queryClient.getQueryData<Message[]>(['messages', activeId])

      const optimistic: LocalMessage = {
        id: `temp-${Date.now()}`,
        conversationId: activeId!,
        senderId: userId || "",
        content: content,
        contentType: "text",
        createdAt: new Date().toISOString(),
        status: 'pending',
        replyTo: replyContext,
        replyToId: replyContext?.id
      }

      queryClient.setQueryData<LocalMessage[]>(['messages', activeId], (old) => [...(old || []), optimistic])

      return { previousMessages }
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['messages', activeId], context?.previousMessages)
      setError("فشل إرسال الرسالة")
    },
    onSuccess: (data) => {
      // Replace temp message with real one
      queryClient.setQueryData<LocalMessage[]>(['messages', activeId], (old) => {
        return (old || []).map(m => m.status === 'pending' && m.content === data.content ? { ...data, status: 'sent' } : m)
      })
      
      // Update conversation list last message
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
        return (old || []).map(c => {
            if (c.id === activeId) {
                return { ...c, lastMessageAt: new Date().toISOString(), messages: [data], hasUnread: false, unreadCount: 0 }
            }
            return c
        }).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime())
      })
    }
  })

  const createDirectMutation = useMutation({
    mutationFn: (uid: string) => conversationService.createDirect(uid, token || undefined),
    onSuccess: (data) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
        if (old?.some(c => c.id === data.id)) return old
        return [data, ...(old || [])]
      })
      setActiveId(data.id)
      setIsSidebarOpen(false)
    }
  })

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => conversationService.markAsRead(id, token || undefined),
    onSuccess: (_, id) => {
       queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
         return (old || []).map(c => c.id === id ? { ...c, hasUnread: false, unreadCount: 0 } : c)
       })
    }
  })

  // Mark as read when opening conversation
  useEffect(() => {
    if (activeId) {
      markAsReadMutation.mutate(activeId)
    }
  }, [activeId])

  const createGroupMutation = useMutation({
    mutationFn: () => conversationService.createGroup(groupTitle, groupParticipants, token || undefined),
    onSuccess: (data) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
        if (old?.some(c => c.id === data.id)) return old
        return [data, ...(old || [])]
      })
      setActiveId(data.id)
      setIsSidebarOpen(false)
      setIsGroupModalOpen(false)
      setGroupTitle("")
      setGroupParticipants([])
    }
  })

  const addParticipantMutation = useMutation({
    mutationFn: (userId: string) => conversationService.addParticipant(activeId!, userId, token || undefined),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] }) // Refetch to get updated participants
        setMemberToAdd("")
    }
  })

  const removeParticipantMutation = useMutation({
    mutationFn: (userId: string) => conversationService.removeParticipant(activeId!, userId, token || undefined),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })

  const editMessageMutation = useMutation({
    mutationFn: () => conversationService.editMessage(editingMessageId!, editContent, token || undefined),
    onSuccess: (data) => {
        queryClient.setQueryData<Message[]>(['messages', activeId], (old) => 
            (old || []).map(m => m.id === data.id ? data : m)
        )
        setEditingMessageId(null)
        setEditContent("")
    }
  })

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => conversationService.deleteMessage(messageId, token || undefined),
    onSuccess: (_, messageId) => {
        queryClient.setQueryData<Message[]>(['messages', activeId], (old) => 
            (old || []).map(m => m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), content: "تم حذف هذه الرسالة" } : m)
        )
    }
  })

  // Deep link support
  useEffect(() => {
    const uid = searchParams.get("userId")
    const teamId = searchParams.get("teamId")
    const ownerGroup = searchParams.get("ownerGroup")

    if (uid) createDirectMutation.mutate(uid)
    else if (teamId) {
        conversationService.createTeamGroup(teamId, token || undefined).then(conv => {
            queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
                if (old?.some(c => c.id === conv.id)) return old
                return [conv, ...(old || [])]
            })
            setActiveId(conv.id)
        })
    }
    else if (ownerGroup) {
        conversationService.getOwnerGroup(token || undefined).then(conv => {
            queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
                if (old?.some(c => c.id === conv.id)) return old
                return [conv, ...(old || [])]
            })
            setActiveId(conv.id)
        })
    }
  }, [searchParams, token]) // eslint-disable-line

  // Helper to check read status
  const isMessageRead = (message: Message) => {
      if (message.senderId !== userId) return false
      
      const convo = conversations.find(c => c.id === message.conversationId)
      if (!convo || !convo.participants) return false

      // Direct
      if (convo.type === 'direct') {
          const other = convo.participants.find(p => p.userId !== userId)
          if (!other || !other.lastReadAt) return false
          return new Date(other.lastReadAt).getTime() >= new Date(message.createdAt).getTime()
      }
      
      // Group: Check if ALL other participants have read the message
      const otherParticipants = convo.participants.filter(p => p.userId !== userId)
      if (otherParticipants.length === 0) return false
      
      return otherParticipants.every(p => {
          if (!p.lastReadAt) return false
          return new Date(p.lastReadAt).getTime() >= new Date(message.createdAt).getTime()
      })
  }

  // Socket Events
  useEffect(() => {
    if (!socket) return

    const handleMessage = (message: Message) => {
      if (message.senderId === userId) return

      // Update messages if active
      if (activeId === message.conversationId) {
         queryClient.setQueryData<Message[]>(['messages', activeId], (old) => {
            if (old?.some(m => m.id === message.id)) return old
            return [...(old || []), message]
         })
         // Mark as read immediately if window is focused
         markAsReadMutation.mutate(activeId)
      }

      // Update conversations list
      queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
         const exists = old?.find(c => c.id === message.conversationId)
         if (!exists) {
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            return old
         }

         return (old || []).map(c => {
           if (c.id === message.conversationId) {
              return {
                ...c,
                lastMessageAt: message.createdAt,
                messages: [message],
                unreadCount: activeId === message.conversationId ? 0 : (c.unreadCount || 0) + 1,
                hasUnread: activeId === message.conversationId ? false : true
              }
           }
           return c
         }).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime())
      })
    }

    const handleRead = (data: { conversationId: string, userId: string, lastReadAt: string }) => {
        // Update conversation participants lastReadAt
        queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
            return (old || []).map(c => {
                if (c.id === data.conversationId) {
                    return {
                        ...c,
                        participants: c.participants?.map(p => {
                            if (p.userId === data.userId) {
                                return { ...p, lastReadAt: data.lastReadAt }
                            }
                            return p
                        })
                    }
                }
                return c
            })
        })
    }

    const handleTyping = (data: { conversationId: string, userId: string }) => {
        if (data.conversationId !== activeId) return
        if (data.userId === userId) return

        setTypingUsers(prev => {
            const next = new Set(prev)
            next.add(data.userId)
            return next
        })
        
        // Auto clear after 3 seconds
        setTimeout(() => {
            setTypingUsers(prev => {
                const next = new Set(prev)
                next.delete(data.userId)
                return next
            })
        }, 3000)
    }

    const handleJoin = (data: { conversationId: string }) => {
        if (data.conversationId === activeId) {
             queryClient.invalidateQueries({ queryKey: ['conversations'] })
        }
    }

    const handleUserStatus = ({ userId: uid, isOnline, lastSeen }: any) => {
       queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
          return (old || []).map(c => ({
            ...c,
            participants: c.participants?.map(p => {
               if (p.userId === uid) {
                 return { ...p, user: { ...(p.user || {} as User), isOnline, lastSeen, id: uid, email: p.user?.email || "" } as User }
               }
               return p
            })
          }))
       })
    }

    const handleMessageUpdate = (updated: Message) => {
       if (activeId === updated.conversationId) {
           queryClient.setQueryData<Message[]>(['messages', activeId], (old) => 
               (old || []).map(m => m.id === updated.id ? updated : m)
           )
       }
       queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
           return (old || []).map(c => {
               if (c.id === updated.conversationId && c.messages?.length && c.messages[0].id === updated.id) {
                   return { ...c, messages: [updated] }
               }
               return c
           })
       })
    }

    const handleMessageDelete = (data: { id: string, conversationId: string, deletedAt: string }) => {
       if (activeId === data.conversationId) {
           queryClient.setQueryData<Message[]>(['messages', activeId], (old) => 
               (old || []).map(m => m.id === data.id ? { ...m, deletedAt: data.deletedAt, content: "تم حذف هذه الرسالة" } : m)
           )
       }
       queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
           return (old || []).map(c => {
               if (c.id === data.conversationId && c.messages?.length && c.messages[0].id === data.id) {
                   return { ...c, messages: [{ ...c.messages[0], deletedAt: data.deletedAt, content: "تم حذف هذه الرسالة" }] }
               }
               return c
           })
       })
    }

    socket.on("message:new", handleMessage)
    socket.on("message:updated", handleMessageUpdate)
    socket.on("message:deleted", handleMessageDelete)
    socket.on("conversation:read", handleRead)
    socket.on("typing", handleTyping)
    socket.on("join_conversation", handleJoin)
    socket.on("user:status", handleUserStatus)
    
    return () => {
      socket.off("message:new", handleMessage)
      socket.off("message:updated", handleMessageUpdate)
      socket.off("message:deleted", handleMessageDelete)
      socket.off("conversation:read", handleRead)
      socket.off("typing", handleTyping)
      socket.off("join_conversation", handleJoin)
      socket.off("user:status", handleUserStatus)
    }
  }, [socket, activeId, queryClient, userId, markAsReadMutation])

  // Join/Leave Room
  useEffect(() => {
    if (activeId && socket) {
        socket.emit('join_conversation', activeId)
        return () => {
            socket.emit('leave_conversation', activeId)
        }
    }
  }, [activeId, socket])

  // Mark as read when opening
  useEffect(() => {
    if (activeId) {
      markAsReadMutation.mutate(activeId)
      // Scroll to bottom
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    }
  }, [activeId])

  // Scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, activeId])

  const handleSend = async () => {
    if (!activeId || !input.trim()) return
    const content = input.trim()
    const replyContext = replyingTo || undefined
    const replyToId = replyingTo?.id

    setInput("")
    setReplyingTo(null)
    sendMessageMutation.mutate({ content, replyToId, replyContext })
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = e.target.value ? `${Math.min(e.target.scrollHeight, 120)}px` : 'auto'
    
    if (activeId && socket) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      socket.emit("typing", { conversationId: activeId, userId })
      typingTimeoutRef.current = setTimeout(() => {
         // Stop typing (handled by client timeout for now)
      }, 1000)
    }
  }

  const handleStartDirect = () => {
    if (targetUserId) {
      createDirectMutation.mutate(targetUserId)
      setTargetUserId("")
    }
  }

  // Helpers
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
      return conversation.title || "مجموعة الفريق"
    }
    if (conversation.type === "system_leaders") {
        return "مجموعة القادة"
    }
    return conversation.title || "محادثة"
  }
  
  const getOtherParticipant = (conversation: Conversation) => {
      if (conversation.type === "direct") {
          return conversation.participants?.find(p => p.userId !== userId)?.user
      }
      return null
  }

  const groups = conversations.filter(c => c.type !== "direct")
  const directs = conversations.filter(c => c.type === "direct")
  const activeConversation = conversations.find(c => c.id === activeId)
  
  // Shortcuts Logic
  const myTeam = useMemo(() => {
    if (role === 'sales') return teams?.find(t => t.members?.some(m => m.userId === userId))
    if (role === 'team_leader') return teams?.find(t => t.leaderUserId === userId)
    return null
  }, [teams, userId, role])

  const leaderUser = useMemo(() => {
    if (role === 'sales' && myTeam?.leaderUserId) return users?.find(u => u.id === myTeam.leaderUserId)
    return null
  }, [myTeam, users, role])

  const owners = useMemo(() => users?.filter(u => u.roles?.includes('owner')) || [], [users])

  const teamMembers = useMemo(() => {
    if (role === 'team_leader' && myTeam?.members) {
      return myTeam.members.map(m => users?.find(u => u.id === m.userId)).filter((u): u is User => !!u)
    }
    return []
  }, [role, myTeam, users])

  const handleQuickAccess = async (type: 'direct' | 'team_group', id: string) => {
      if (type === 'direct') createDirectMutation.mutate(id)
      else if (type === 'team_group') {
         try {
             const conv = await conversationService.createTeamGroup(id, token || undefined)
             queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
                if (old?.some(c => c.id === conv.id)) return old
                return [conv, ...(old || [])]
            })
             setActiveId(conv.id)
             setIsSidebarOpen(false)
         } catch {}
      }
  }

  const allowedUsers = useMemo(() => {
    const list = (users || []).filter((user) => user.id !== userId)
    if (role === "owner") return list
    if (role === "team_leader") {
      const myTeams = (teams || []).filter((team) => team.leaderUserId === userId)
      const memberIds = new Set(myTeams.flatMap(t => (t.members || []).map(m => m.userId)))
      return list.filter((user) => (user.roles || []).includes("owner") || memberIds.has(user.id))
    }
    if (role === "sales") {
      const myTeam = (teams || []).find((team) => (team.members || []).some((member) => member.userId === userId))
      const leaderId = myTeam?.leaderUserId
      const colleagueIds = new Set((myTeam?.members || []).map(m => m.userId))
      return list.filter((user) => (user.roles || []).includes("owner") || (leaderId && user.id === leaderId) || colleagueIds.has(user.id))
    }
    return []
  }, [role, teams, userId, users])

  const eligibleGroupMembers = useMemo(() => {
    const list = (users || []).filter((user) => user.id !== userId)
    if (role === 'owner') return list
    if (role === 'team_leader') {
       const myTeams = (teams || []).filter((team) => team.leaderUserId === userId)
       const memberIds = new Set(myTeams.flatMap(t => (t.members || []).map(m => m.userId)))
       return list.filter((user) => memberIds.has(user.id))
    }
    return []
  }, [role, teams, userId, users])

  // Group Messages by Date
  const groupedMessages = useMemo(() => {
    if (!messages || messages.length === 0) return []
    
    const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const groups: { date: string; messages: Message[] }[] = []
    
    sorted.forEach(msg => {
        const date = new Date(msg.createdAt)
        let dateLabel = format(date, 'yyyy-MM-dd')
        
        if (isSameDay(date, new Date())) {
            dateLabel = 'اليوم'
        } else if (isYesterday(date)) {
            dateLabel = 'أمس'
        } else {
            dateLabel = format(date, 'd MMMM yyyy', { locale: ar })
        }
        
        const lastGroup = groups[groups.length - 1]
        if (lastGroup && lastGroup.date === dateLabel) {
            lastGroup.messages.push(msg)
        } else {
            groups.push({ date: dateLabel, messages: [msg] })
        }
    })
    
    return groups
  }, [messages])



  return (
    <div className="flex h-[calc(100dvh-140px)] gap-4 overflow-hidden rounded-xl bg-base-0 shadow-sm border border-base-200">
      {/* Sidebar */}
      <div className={`flex w-full flex-col border-l border-base-100 bg-base-50/50 md:w-80 ${isSidebarOpen ? "block" : "hidden md:flex"}`}>
        <div className="p-4 border-b border-base-100 space-y-4">
          
          {/* Shortcuts Section */}
          {(role === 'sales' || role === 'team_leader') && (
            <div className="space-y-2 pb-4 border-b border-base-200/50">
               <h3 className="text-xs font-bold text-base-400 uppercase tracking-wider mb-2">الوصول السريع</h3>
               <div className="flex flex-wrap gap-2">
                  {myTeam && (
                    <Button size="sm" variant="outline" className="text-xs bg-white hover:bg-brand-50 hover:text-brand-600 border-base-200" onClick={() => handleQuickAccess('team_group', myTeam.id)}>
                      <span className="ml-1">👥</span> مجموعة الفريق
                    </Button>
                  )}
                  {leaderUser && (
                     <Button size="sm" variant="outline" className="text-xs bg-white hover:bg-brand-50 hover:text-brand-600 border-base-200" onClick={() => handleQuickAccess('direct', leaderUser.id)}>
                      <span className="ml-1">👤</span> قائد الفريق
                    </Button>
                  )}
                  {owners.map(owner => (
                     <Button key={owner.id} size="sm" variant="outline" className="text-xs bg-white hover:bg-brand-50 hover:text-brand-600 border-base-200" onClick={() => handleQuickAccess('direct', owner.id)}>
                      <span className="ml-1">👑</span> {owner.name || "المالك"}
                    </Button>
                  ))}
               </div>
               {role === 'team_leader' && teamMembers.length > 0 && (
                 <div className="mt-2">
                    <p className="text-[10px] text-base-400 mb-1">أعضاء الفريق:</p>
                    <div className="flex flex-wrap gap-1">
                      {teamMembers.map((member: User) => (
                        <button key={member.id} onClick={() => handleQuickAccess('direct', member.id)} className="flex items-center gap-1 bg-white border border-base-200 rounded-full px-2 py-1 hover:bg-brand-50 transition-colors" title={member.name || member.email}>
                          <Avatar src={member.profile?.avatar} name={member.name || member.email || "?"} size="xs" className="w-5 h-5 text-[9px]" />
                        </button>
                      ))}
                    </div>
                 </div>
               )}
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-base-900">الرسائل</h2>
          </div>
          
          {/* New Chat */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select className="flex-1 text-right" value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
                <option value="">محادثة جديدة...</option>
                {allowedUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.name || user.email}</option>
                ))}
              </Select>
              <Button size="sm" disabled={!targetUserId} onClick={handleStartDirect} className="px-3">بدء</Button>
            </div>
            {role !== "owner" && (
              <div className="flex">
                <Button size="sm" variant="outline" onClick={() => {
                    conversationService.getOwnerGroup(token || undefined).then(conv => {
                      queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
                          if (old?.some(c => c.id === conv.id)) return old
                          return [conv, ...(old || [])]
                      })
                      setActiveId(conv.id)
                      setIsSidebarOpen(false)
                    })
                  }} className="px-3 w-full">
                  فتح مجموعة المالك
                </Button>
              </div>
            )}
            
            {(role === 'owner' || role === 'team_leader') && (
                <div className="flex">
                    <Button size="sm" variant="outline" onClick={() => setIsGroupModalOpen(true)} className="w-full justify-center border-dashed border-base-300 hover:border-brand-500 hover:text-brand-600">
                        <span className="ml-2 font-bold">+</span> إنشاء مجموعة جديدة
                    </Button>
                </div>
            )}
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
                  onClick={() => { setActiveId(conversation.id); setIsSidebarOpen(false); }}
                  className={`w-full justify-start gap-3 px-3 py-2 text-sm font-normal ${activeId === conversation.id ? "bg-brand-50 text-brand-700 font-medium shadow-sm hover:bg-brand-100" : "hover:bg-base-100 text-base-700"}`}
                >
                   <div className="relative">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activeId === conversation.id ? "bg-brand-100 text-brand-600" : "bg-base-200 text-base-500"}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      {(conversation.unreadCount || 0) > 0 && (
                         <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                           {conversation.unreadCount}
                         </span>
                      )}
                   </div>
                  <span className="truncate">{getConversationTitle(conversation)}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Directs */}
          <div className="space-y-1">
            <p className="px-2 text-xs font-bold text-base-400 uppercase tracking-wider">الرسائل المباشرة</p>
            {directs.map((conversation) => {
              const other = getOtherParticipant(conversation)
              const isOnline = other?.isOnline
              return (
                <Button
                  key={conversation.id}
                  variant="ghost"
                  onClick={() => { setActiveId(conversation.id); setIsSidebarOpen(false); }}
                  className={`w-full h-auto justify-start gap-3 px-3 py-2 text-sm font-normal ${activeId === conversation.id ? "bg-brand-50 text-brand-700 font-medium shadow-sm hover:bg-brand-100" : "hover:bg-base-100 text-base-700"}`}
                >
                  <div className="relative">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activeId === conversation.id ? "bg-brand-100 text-brand-600" : "bg-base-200 text-base-500"}`}>
                      <span className="text-xs font-bold">{getConversationTitle(conversation).charAt(0).toUpperCase()}</span>
                    </div>
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white"></span>
                    )}
                    {(conversation.unreadCount || 0) > 0 && (
                       <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                         {conversation.unreadCount}
                       </span>
                    )}
                  </div>
                  <div className="flex flex-col items-start overflow-hidden flex-1">
                    <div className="flex w-full justify-between items-center">
                        <span className="truncate text-right font-medium">{getConversationTitle(conversation)}</span>
                        {conversation.lastMessageAt && <span className="text-[10px] text-base-400 shrink-0">{formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: false, locale: ar }).replace('حوالي', '').replace('أقل من دقيقة', 'الآن')}</span>}
                    </div>
                    <span className={`truncate w-full text-right text-xs ${activeId === conversation.id ? "text-brand-500/80" : conversation.hasUnread ? "text-base-900 font-bold" : "text-base-400"}`}>
                      {conversation.messages?.[0]?.content || "لا توجد رسائل"}
                    </span>
                  </div>
                </Button>
              )
            })}
            {directs.length === 0 && <p className="px-3 text-xs text-base-400">لا توجد محادثات</p>}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex flex-1 flex-col ${!isSidebarOpen ? "block" : "hidden md:flex"}`}>
        {activeId ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-base-100 p-3 bg-white/50 backdrop-blur-sm shadow-sm z-10">
              <Button variant="ghost" onClick={() => setIsSidebarOpen(true)} className="md:hidden p-1 rounded-lg hover:bg-base-100 text-base-500 h-auto">
                <svg className={`w-6 h-6 ${dir === 'rtl' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
              <div className="flex-1">
                <h3 className="font-bold text-base-900">{getConversationTitle(conversations.find(c => c.id === activeId)!)}</h3>
                {activeConversation?.type === 'direct' && (() => {
                    const other = getOtherParticipant(activeConversation)
                    if (!other) return null
                    if (typingUsers.has(other.id)) return <span className="text-xs text-brand-600 font-medium animate-pulse">جاري الكتابة...</span>
                    return (
                        <div className="flex items-center gap-1 text-xs text-base-500">
                             {other.isOnline ? (
                                 <>
                                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                    <span className="text-green-600 font-medium">متصل الآن</span>
                                 </>
                             ) : (
                                 other.lastSeen ? <span>آخر ظهور {formatDistanceToNow(new Date(other.lastSeen), { addSuffix: true, locale: ar })}</span> : <span>غير متصل</span>
                             )}
                        </div>
                    )
                })()}
                {activeConversation?.type !== 'direct' && typingUsers.size > 0 && (
                   <span className="text-xs text-brand-600 font-medium animate-pulse">
                     {Array.from(typingUsers).map(uid => users?.find(u => u.id === uid)?.name).join(', ')} يكتب...
                   </span>
                )}
              </div>
              {activeConversation?.type !== "direct" && (
                <Button variant="ghost" onClick={() => setIsGroupInfoOpen(true)} className="p-2 rounded-full hover:bg-base-100 text-base-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </Button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#e5ddd5] dark:bg-[#0b141a]">
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
                groupedMessages.map((group, groupIndex) => (
                    <div key={groupIndex} className="space-y-2">
                        {/* Date Separator */}
                        <div className="flex justify-center my-4 sticky top-2 z-10">
                            <span className="bg-white/80 dark:bg-gray-800/80 backdrop-blur text-gray-500 dark:text-gray-400 text-[11px] px-3 py-1 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                                {group.date}
                            </span>
                        </div>
                        
                        {group.messages.map((message, index) => {
                            const isMine = message.senderId === userId
                            const sender = users?.find(u => u.id === message.senderId)
                            const isRead = isMessageRead(message)
                            
                            // Visual Grouping Logic
                            const prevMessage = group.messages[index - 1]
                            const nextMessage = group.messages[index + 1]
                            const isFirstInSequence = !prevMessage || prevMessage.senderId !== message.senderId
                            const isLastInSequence = !nextMessage || nextMessage.senderId !== message.senderId
                            
                            // System Message
                            if (message.contentType === 'system') {
                                return (
                                    <div key={message.id} className="flex justify-center my-2">
                                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs px-2 py-1 rounded-full shadow-sm">
                                            {message.content}
                                        </span>
                                    </div>
                                )
                            }

                            return (
                                <div key={message.id} id={`msg-${message.id}`} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"} ${!isLastInSequence ? "mb-0.5" : "mb-2"}`}>
                                    {/* Avatar: Only show for last message in sequence for other users in groups */}
                                    {!isMine && (activeConversation?.type !== "direct") && (
                                        <div className="w-6 shrink-0">
                                            {isLastInSequence && (
                                                <Avatar size="xs" name={sender?.name || sender?.email || "?"} className="w-6 h-6 text-[10px]" />
                                            )}
                                        </div>
                                    )}
                                    
                                    <div className={`relative max-w-[85%] sm:max-w-[75%] px-2 py-1.5 shadow-sm text-sm group ${
                                        isMine 
                                        ? `bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-white ${isFirstInSequence ? "rounded-tr-none" : "rounded-tr-lg"} ${isLastInSequence ? "rounded-br-lg" : "rounded-br-md"} rounded-l-lg`
                                        : `bg-white dark:bg-[#202c33] text-gray-900 dark:text-white ${isFirstInSequence ? "rounded-tl-none" : "rounded-tl-lg"} ${isLastInSequence ? "rounded-bl-lg" : "rounded-bl-md"} rounded-r-lg`
                                    }`}>
                                        {/* Sender Name: Only show for first message in sequence in groups */}
                                        {!isMine && isFirstInSequence && (activeConversation?.type === "team_group" || activeConversation?.type === "system_leaders") && (
                                            <p className={`text-[11px] font-bold mb-0.5 ${['text-orange-600', 'text-blue-600', 'text-purple-600', 'text-green-600'][((sender?.name?.length || 0) % 4)]}`}>
                                                {sender?.name || sender?.email}
                                            </p>
                                        )}
                                        
                                        <div className="flex flex-wrap items-end gap-x-2 gap-y-0 relative group/msg">
                                            {message.replyTo && (
                                                <div className="w-full mb-1 bg-black/5 dark:bg-white/10 rounded-md p-1 border-r-4 border-r-brand-500 text-xs cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                                                     onClick={() => {
                                                        const el = document.getElementById(`msg-${message.replyToId}`);
                                                        if (el) {
                                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            el.classList.add('bg-brand-100/50');
                                                            setTimeout(() => el.classList.remove('bg-brand-100/50'), 1000);
                                                        }
                                                     }}>
                                                    <p className="font-bold text-brand-600 dark:text-brand-400 truncate">
                                                        {message.replyTo.sender?.profile?.firstName || message.replyTo.sender?.email || "مستخدم"}
                                                    </p>
                                                    <p className="truncate text-gray-600 dark:text-gray-300">
                                                        {message.replyTo.content || "مرفق"}
                                                    </p>
                                                </div>
                                            )}
                                            {message.deletedAt ? (
                                                <p className={`whitespace-pre-wrap leading-relaxed ${textAlign} min-w-[60px] pb-1 pl-1 text-gray-500 italic flex items-center gap-1`}>
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                                    تم حذف هذه الرسالة
                                                </p>
                                            ) : editingMessageId === message.id ? (
                                                <div className="w-full flex flex-col gap-2 min-w-[200px]">
                                                    <Input 
                                                        value={editContent} 
                                                        onChange={(e) => setEditContent(e.target.value)}
                                                        className="h-8 text-sm bg-white/50 border-none focus:ring-1 focus:ring-brand-500"
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => { setEditingMessageId(null); setEditContent(""); }} className="p-1 hover:bg-black/10 rounded text-red-600">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                        <button onClick={() => editMessageMutation.mutate()} className="p-1 hover:bg-black/10 rounded text-green-600">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className={`whitespace-pre-wrap leading-relaxed ${textAlign} min-w-[60px] pb-1 pl-1`}>
                                                        {message.content}
                                                    </p>
                                                    
                                                    {/* Message Actions */}
                                                    {!message.deletedAt && (
                                                        <div className={`absolute top-0 ${isMine ? 'right-0 rounded-bl-lg' : 'left-0 rounded-br-lg'} opacity-0 group-hover/msg:opacity-100 transition-opacity bg-black/5 dark:bg-white/10 px-1 flex gap-1 backdrop-blur-sm z-10`}>
                                                            <button 
                                                                onClick={() => setReplyingTo(message)}
                                                                className="p-1 hover:text-brand-600 transition-colors"
                                                                title="رد"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                                            </button>
                                                            {isMine && (
                                                              <>
                                                                <button 
                                                                    onClick={() => { setEditingMessageId(message.id); setEditContent(message.content || ""); }}
                                                                    className="p-1 hover:text-blue-600 transition-colors"
                                                                    title="تعديل"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                                </button>
                                                                <button 
                                                                    onClick={() => { if(confirm("هل أنت متأكد من حذف الرسالة؟")) deleteMessageMutation.mutate(message.id); }}
                                                                    className="p-1 hover:text-red-600 transition-colors"
                                                                    title="حذف"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                              </>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            
                                            <div className="flex items-center gap-0.5 opacity-60 shrink-0 ml-auto select-none self-end h-4 mb-0.5">
                                                {message.editedAt && !message.deletedAt && (
                                                    <span className="text-[9px] italic mx-1">(معدل)</span>
                                                )}
                                                <span className="text-[10px] min-w-fit pt-0.5">
                                                    {new Date(message.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </span>
                                                {isMine && (
                                                    <MessageStatusIcon 
                                                        status={(message as LocalMessage).status} 
                                                        isRead={isRead} 
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Tail */}
                                        <div className={`absolute top-0 w-0 h-0 border-[6px] border-transparent ${
                                            isMine 
                                            ? "-right-[6px] border-t-[#d9fdd3] dark:border-t-[#005c4b] border-r-0" 
                                            : "-left-[6px] border-t-white dark:border-t-[#202c33] border-l-0"
                                        }`} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex flex-col bg-[#f0f2f5] dark:bg-[#202c33] border-t border-gray-200 dark:border-gray-700">
              {replyingTo && (
                  <div className="px-4 py-2 bg-white dark:bg-[#1f2c34] border-r-4 border-r-brand-500 flex justify-between items-center mx-2 mt-2 rounded-lg shadow-sm animate-in slide-in-from-bottom-2 duration-200">
                      <div className="flex flex-col overflow-hidden gap-0.5">
                          <span className="text-brand-600 dark:text-brand-400 font-bold text-xs">
                              {replyingTo.sender?.profile?.firstName || replyingTo.sender?.email || "مستخدم"}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 truncate text-xs max-w-[300px]">
                              {replyingTo.content || "مرفق"}
                          </span>
                      </div>
                      <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
              )}
              <div className="p-2 sm:p-3">
              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                <Button variant="ghost" className="rounded-full w-10 h-10 p-0 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hidden sm:flex">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
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
                  disabled={!input.trim() || sendMessageMutation.isPending} 
                  className={`rounded-full w-10 h-10 p-0 flex items-center justify-center transition-all ${input.trim() ? "bg-[#00a884] hover:bg-[#008f6f] text-white shadow-md transform scale-100" : "bg-gray-300 dark:bg-gray-600 text-gray-500 scale-95"}`}
                >
                  {sendMessageMutation.isPending ? (
                     <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <svg className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''} translate-x-[2px]`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  )}
                </Button>
              </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-base-400 bg-base-50/30 border-b-[6px] border-b-[#00a884]">
            <div className="h-24 w-24 rounded-full bg-base-100 flex items-center justify-center mb-6 shadow-sm">
              <svg className="w-12 h-12 text-[#00a884]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h1 className="text-2xl font-light text-base-600 mb-2">CRM Doctor Web</h1>
            <p className="text-sm text-base-500 mt-2 max-w-md text-center leading-relaxed">
              أرسل واستقبل الرسائل دون الحاجة إلى إبقاء هاتفك متصلاً بالإنترنت.<br/>
              استخدم CRM Doctor على ما يصل إلى 4 أجهزة مرتبطة وهاتف واحد في نفس الوقت.
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs text-base-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                مشفرة تماماً بين الطرفين
            </div>
          </div>
        )}
      </div>

      <Modal 
         isOpen={isGroupModalOpen} 
         onClose={() => setIsGroupModalOpen(false)} 
         title="إنشاء مجموعة جديدة"
      >
         <div className="space-y-4 pt-4">
            <div>
               <label className="block text-sm font-medium mb-1">اسم المجموعة</label>
               <Input 
                 value={groupTitle} 
                 onChange={(e) => setGroupTitle(e.target.value)} 
                 placeholder="اسم المجموعة..." 
               />
            </div>
            <div>
               <label className="block text-sm font-medium mb-2">الأعضاء ({groupParticipants.length})</label>
               <div className="max-h-60 overflow-y-auto border border-base-200 rounded-lg p-2 space-y-1 bg-base-50">
                  {eligibleGroupMembers.length === 0 ? (
                      <p className="text-sm text-base-400 text-center py-4">لا يوجد أعضاء متاحين</p>
                  ) : (
                      eligibleGroupMembers.map(user => (
                          <div key={user.id} className="flex items-center gap-2 p-1.5 hover:bg-base-100 rounded cursor-pointer" onClick={() => {
                              const checked = groupParticipants.includes(user.id)
                              if (!checked) setGroupParticipants(prev => [...prev, user.id])
                              else setGroupParticipants(prev => prev.filter(id => id !== user.id))
                          }}>
                              <Checkbox 
                                 checked={groupParticipants.includes(user.id)}
                                 onChange={() => {}} // Handled by parent div
                              />
                              <Avatar src={user.profile?.avatar} name={user.name || user.email} size="sm" />
                              <span className="text-sm">{user.name || user.email}</span>
                          </div>
                      ))
                  )}
               </div>
            </div>
            <div className="flex justify-end pt-2">
                <Button 
                   onClick={() => createGroupMutation.mutate()} 
                   disabled={!groupTitle || groupParticipants.length === 0 || createGroupMutation.isPending}
                >
                   {createGroupMutation.isPending ? "جاري الإنشاء..." : "إنشاء المجموعة"}
                </Button>
            </div>
         </div>
      </Modal>

      {/* Group Info Modal */}
      <Modal
          isOpen={isGroupInfoOpen}
          onClose={() => setIsGroupInfoOpen(false)}
          title={activeConversation ? getConversationTitle(activeConversation) : "معلومات المجموعة"}
      >
          <div className="space-y-6 pt-4">
              {/* Header Info */}
              <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="h-16 w-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-2xl font-bold">
                      {activeConversation ? getConversationTitle(activeConversation).charAt(0).toUpperCase() : "?"}
                  </div>
                  <h3 className="text-lg font-bold">{activeConversation ? getConversationTitle(activeConversation) : ""}</h3>
                  <p className="text-sm text-base-500">
                      {activeConversation?.participants?.length || 0} أعضاء
                  </p>
              </div>

              {/* Members List */}
              <div>
                  <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-bold text-base-900">الأعضاء</h4>
                  </div>
                  
                  {/* Add Member Section */}
                  {(role === "owner" || activeConversation?.participants?.find(p => p.userId === userId)?.role === "admin") && (
                      <div className="mb-4 p-3 bg-base-50 rounded-lg border border-base-200">
                          <label className="block text-xs font-medium mb-2 text-base-500">إضافة عضو جديد</label>
                          <div className="flex gap-2">
                              <Select 
                                  value={memberToAdd} 
                                  onChange={(e) => setMemberToAdd(e.target.value)}
                                  className="text-sm"
                              >
                                  <option value="">اختر عضواً لإضافته...</option>
                                  {eligibleGroupMembers
                                      .filter(u => !activeConversation?.participants?.some(p => p.userId === u.id))
                                      .map(user => (
                                      <option key={user.id} value={user.id}>{user.name || user.email}</option>
                                  ))}
                              </Select>
                              <Button 
                                  size="sm" 
                                  disabled={!memberToAdd || addParticipantMutation.isPending}
                                  onClick={() => addParticipantMutation.mutate(memberToAdd)}
                              >
                                  إضافة
                              </Button>
                          </div>
                      </div>
                  )}

                  <div className="max-h-60 overflow-y-auto space-y-1">
                      {activeConversation?.participants?.map(participant => {
                          const user = users?.find(u => u.id === participant.userId)
                          const isAdmin = participant.role === "admin"
                          const isMe = participant.userId === userId
                          const canRemove = (role === "owner" || activeConversation?.participants?.find(p => p.userId === userId)?.role === "admin") && !isMe

                          if (!user) return null

                          return (
                              <div key={participant.id} className="flex items-center justify-between p-2 hover:bg-base-50 rounded-lg group">
                                  <div className="flex items-center gap-3">
                                      <Avatar src={user.profile?.avatar} name={user.name || user.email || "?"} size="sm" />
                                      <div>
                                          <p className="text-sm font-medium text-base-900 flex items-center gap-1">
                                              {user.name || user.email}
                                              {isMe && <span className="text-[10px] bg-base-200 px-1 rounded text-base-600">أنت</span>}
                                          </p>
                                          <p className="text-xs text-base-500">
                                              {isAdmin ? "مشرف المجموعة" : "عضو"}
                                          </p>
                                      </div>
                                  </div>
                                  {canRemove && (
                                      <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                          onClick={() => {
                                              if (confirm("هل أنت متأكد من حذف هذا العضو؟")) {
                                                  removeParticipantMutation.mutate(user.id)
                                              }
                                          }}
                                      >
                                          حذف
                                      </Button>
                                  )}
                              </div>
                          )
                      })}
                  </div>
              </div>

              {/* Leave Group */}
              {activeConversation?.type === "group" && (
                  <div className="pt-4 border-t border-base-100">
                      <Button 
                          variant="outline" 
                          className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                          onClick={() => {
                              if (confirm("هل أنت متأكد من مغادرة المجموعة؟")) {
                                  removeParticipantMutation.mutate(userId)
                                  setIsGroupInfoOpen(false)
                                  setActiveId(null)
                              }
                          }}
                      >
                          مغادرة المجموعة
                      </Button>
                  </div>
              )}
          </div>
      </Modal>
    </div>
  )
}
