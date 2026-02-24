import { Request, Response } from "express"
import { conversationService } from "./service"
import { coreService } from "../core/service"
import { logActivity } from "../../utils/activity"
import { prisma } from "../../prisma/client"

export const conversationController = {
  list: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    if (user.roles.includes("owner")) {
      await conversationService.ensureOwnerGroup(tenantId)
      const list = await conversationService.listConversationsForUser(tenantId, user)
      res.json(list)
      return
    }
    const teamLeaderTeam = user.roles.includes("team_leader")
      ? await coreService.getTeamByLeader(tenantId, user.id)
      : null
    const leaderTeamId = teamLeaderTeam?.id
    const myTeams = await prisma.teamMember.findMany({
      where: { tenantId, userId: user.id, leftAt: null, deletedAt: null },
      select: { teamId: true }
    })
    if (leaderTeamId) await conversationService.ensureTeamGroup(tenantId, leaderTeamId)
    for (const teamRow of myTeams) await conversationService.ensureTeamGroup(tenantId, teamRow.teamId)
    const ownerRole = await coreService.getOrCreateRole(tenantId, "owner")
    const ownerLinks = await coreService.listUsers(tenantId)
    const ownerUser = ownerLinks.find((u) => (u.roleLinks || []).some((link) => link.roleId === ownerRole.id))
    if (ownerUser) await conversationService.ensureDirect(tenantId, user.id, ownerUser.id)
    if (user.roles.includes("sales")) {
      const membership = await prisma.teamMember.findFirst({
        where: { tenantId, userId: user.id, leftAt: null, deletedAt: null },
        select: { teamId: true }
      })
      if (membership?.teamId) {
        const team = await prisma.team.findFirst({ where: { tenantId, id: membership.teamId, deletedAt: null } })
        if (team?.leaderUserId) {
          await conversationService.ensureDirect(tenantId, user.id, team.leaderUserId)
        }
      }
    }
    await conversationService.ensureOwnerGroup(tenantId)
    const list = await conversationService.listConversationsForUser(tenantId, user)
    res.json(list)
  },
  listMessages: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    const limit = req.query.limit ? Number(req.query.limit) : 50
    const messages = await conversationService.listMessages(tenantId, req.params.id, user, limit)
    res.json(messages)
  },
  sendMessage: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    const content = req.body?.content ? String(req.body.content) : undefined
    const contentType = req.body?.contentType ? String(req.body.contentType) : "text"
    const mediaFileId = req.body?.mediaFileId ? String(req.body.mediaFileId) : undefined
    const mediaDuration = req.body?.mediaDuration ? Number(req.body.mediaDuration) : undefined
    const replyToId = req.body?.replyToId ? String(req.body.replyToId) : undefined
    const message = await conversationService.sendMessage(tenantId, req.params.id, user, { content, contentType, mediaFileId, mediaDuration, replyToId })
    await logActivity({ tenantId, actorUserId: user.id, action: "conversation.message.sent", entityType: "message", entityId: message.id })
    res.json(message)
  },
  createDirect: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    const targetUserId = String(req.body?.targetUserId || "")
    if (!targetUserId) throw { status: 400, message: "المستخدم مطلوب" }
    if (targetUserId === user.id) throw { status: 400, message: "غير مسموح" }
    const targetUser = await coreService.getUserById(tenantId, targetUserId)
    if (!targetUser) throw { status: 404, message: "المستخدم غير موجود" }
    const targetRoles = targetUser.roleLinks?.map((link) => link.role.name) || []
    if (user.roles.includes("owner")) {
      const convo = await conversationService.ensureDirect(tenantId, user.id, targetUserId)
      res.json(convo)
      return
    }
    if (user.roles.includes("team_leader")) {
      if (targetRoles.includes("owner")) {
        const convo = await conversationService.ensureDirect(tenantId, user.id, targetUserId)
        res.json(convo)
        return
      }
      const leaderTeam = await coreService.getTeamByLeader(tenantId, user.id)
      if (!leaderTeam) throw { status: 400, message: "لا يوجد فريق مرتبط بك" }
      const member = await prisma.teamMember.findFirst({
        where: { tenantId, teamId: leaderTeam.id, userId: targetUserId, leftAt: null, deletedAt: null }
      })
      if (!member) throw { status: 403, message: "غير مصرح" }
      const convo = await conversationService.ensureDirect(tenantId, user.id, targetUserId)
      res.json(convo)
      return
    }
    if (user.roles.includes("sales")) {
      if (targetRoles.includes("owner")) {
        const convo = await conversationService.ensureDirect(tenantId, user.id, targetUserId)
        res.json(convo)
        return
      }
      const membership = await prisma.teamMember.findFirst({
        where: { tenantId, userId: user.id, leftAt: null, deletedAt: null },
        select: { teamId: true }
      })
      if (membership?.teamId) {
        const team = await prisma.team.findFirst({ where: { tenantId, id: membership.teamId, deletedAt: null } })
        if (team?.leaderUserId === targetUserId) {
          const convo = await conversationService.ensureDirect(tenantId, user.id, targetUserId)
          res.json(convo)
          return
        }
      }
      throw { status: 403, message: "غير مصرح" }
    }
    const convo = await conversationService.ensureDirect(tenantId, user.id, targetUserId)
    res.json(convo)
  },
  createTeamGroup: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    const teamId = String(req.body?.teamId || "")
    if (!teamId) throw { status: 400, message: "الفريق مطلوب" }
    const convo = await conversationService.ensureTeamGroup(tenantId, teamId)
    res.json(convo)
  },
  createGroup: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    const title = String(req.body?.title || "")
    const participantIds = Array.isArray(req.body?.participants) ? req.body.participants : []
    
    if (!title) throw { status: 400, message: "اسم المجموعة مطلوب" }
    if (participantIds.length === 0) throw { status: 400, message: "يجب اختيار أعضاء" }

    const convo = await conversationService.createCustomGroup(tenantId, user, title, participantIds)
    res.json(convo)
  },
  getOwnerGroup: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    const convo = await conversationService.ensureOwnerGroup(tenantId)
    res.json(convo)
  },
  markAsRead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    await conversationService.markAsRead(tenantId, req.params.id, user.id)
    res.json({ success: true })
  },
  addParticipant: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    const targetUserId = String(req.body?.userId || "")
    if (!targetUserId) throw { status: 400, message: "المستخدم مطلوب" }
    const result = await conversationService.addParticipant(tenantId, req.params.id, user, targetUserId)
    res.json(result)
  },
  removeParticipant: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    const targetUserId = req.params.userId
    if (!targetUserId) throw { status: 400, message: "المستخدم مطلوب" }
    await conversationService.removeParticipant(tenantId, req.params.id, user, targetUserId)
    res.json({ success: true })
  },
  editMessage: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    const content = req.body?.content
    if (!content) throw { status: 400, message: "المحتوى مطلوب" }
    const message = await conversationService.editMessage(tenantId, req.params.id, user.id, content)
    res.json(message)
  },
  deleteMessage: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    await conversationService.deleteMessage(tenantId, req.params.id, user.id)
    res.json({ success: true })
  },
  pokeUser: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const user = req.user
    if (!user) throw { status: 401, message: "Unauthorized" }
    const targetUserId = req.body.userId
    if (!targetUserId) throw { status: 400, message: "Target user ID required" }
    
    await conversationService.pokeUser(tenantId, targetUserId, user)
    res.json({ success: true })
  }
}
