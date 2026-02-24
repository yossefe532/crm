export type Role = "owner" | "team_leader" | "sales"

export type RoleItem = {
  id: string
  name: string
  scope: string
}

export type Permission = {
  id: string
  code: string
  description?: string | null
  moduleKey?: string | null
}

export type UserPermissionData = {
  rolePermissions: Permission[]
  directPermissions: Permission[]
}

export type CallLog = {
  id: string
  leadId: string
  callerUserId?: string | null
  callTime: string
  durationSeconds?: number | null
  outcome?: string | null
  caller?: User | null
}

export type Lead = {
  id: string
  leadCode: string
  name: string
  status: string
  priority: string
  assignedUserId?: string | null
  teamId?: string | null
  phone?: string | null
  email?: string | null
  budgetMin?: number | null
  budgetMax?: number | null
  desiredLocation?: string | null
  propertyType?: string | null
  profession?: string | null
  sourceLabel?: string | null
  sourceId?: string | null
  notes?: string | null
  isWrongNumber?: boolean
  callCount?: number
  deletedAt?: string | null
  callLogs?: CallLog[]
  meetings?: Meeting[]
  createdAt: string
  updatedAt: string
  
  // Lifecycle fields
  lifecycleStage?: string
  timerStartDate?: string | null
  isTimerExtended?: boolean
  extensions?: LeadExtension[]
}

export type LeadExtension = {
  id: string
  leadId: string
  stateId: string
  requestedBy: string
  approvedBy?: string | null
  reason?: string | null
  status: string
  extensionHours: number
  createdAt: string
  updatedAt: string
}

export type LeadDeadline = {
  id: string
  leadId: string
  stateId: string
  dueAt: string
  status: string
}

export type LeadFailure = {
  id: string
  leadId: string
  failureType: string
  failedBy?: string | null
  reason?: string | null
  status: string
  createdAt: string
}

export type LeadClosure = {
  id: string
  leadId: string
  amount: number
  note?: string | null
  address?: string | null
  closedAt: string
  status?: string
}

export type Meeting = {
  id: string
  leadId: string
  organizerUserId?: string | null
  title: string
  startsAt: string
  endsAt: string
  status: string
  timezone: string
  lead?: Lead
  organizer?: User
}

export type User = {
  id: string
  name?: string
  firstName?: string | null
  lastName?: string | null
  profile?: { firstName?: string | null; lastName?: string | null; avatar?: string | null } | null
  email: string
  phone?: string | null
  status: string
  createdAt: string
  updatedAt: string
  roles?: string[]
  isOnline?: boolean
  lastSeen?: string | null
  teamsLed?: Array<{ id: string; name: string }>
  teamMemberships?: Array<{ teamId: string; teamName?: string | null; role: string }>
}

export type UserRequest = {
  id: string
  status: string
  requestType: string
  payload: any
  createdAt: string
  requester?: User
  requestedBy?: string
  decidedBy?: string
}

export type Team = {
  id: string
  name: string
  leaderUserId?: string | null
  status: string
  createdAt: string
  leader?: User | null
  members?: Array<{ id: string; userId: string; role: string; user?: User }>
  leads?: Array<{ id: string; assignedUserId?: string | null }>
}

export type ConversationParticipant = {
  id: string
  userId: string
  role: string
  lastReadAt?: string | null
  user?: User
}

export type Message = {
  id: string
  conversationId: string
  senderId: string
  content?: string | null
  contentType: string
  mediaFileId?: string | null
  createdAt: string
  sender?: User
  editedAt?: string | null
  deletedAt?: string | null
  replyToId?: string | null
  replyTo?: Message
}

export type Conversation = {
  id: string
  type: string
  title?: string | null
  entityType?: string | null
  entityId?: string | null
  participants?: ConversationParticipant[]
  messages?: Message[]
  updatedAt?: string
  lastMessageAt?: string
  hasUnread?: boolean
  unreadCount?: number
}

export type NotificationEvent = {
  id: string
  eventKey: string
  payload: Record<string, unknown>
  createdAt: string
}

export type Notification = {
  id: string
  type: string // info, success, warning, error, mention, assignment
  title: string
  message: string
  entityId?: string | null
  entityType?: string | null
  actionUrl?: string | null
  metadata?: any
  isRead: boolean
  isArchived: boolean
  createdAt: string
  sender?: {
    id: string
    email: string
    profile?: {
      firstName?: string | null
      lastName?: string | null
      avatarFileId?: string | null
    } | null
  } | null
}

export type PerformanceMetric = {
  label: string
  value: string
  change?: string | number
}

export type FinanceEntry = {
  id: string
  entryType: string
  category: string
  amount: number
  note?: string | null
  occurredAt: string
}
