import { Request, Response } from "express"
import { taskService } from "./service"

export const taskController = {
  create: async (req: Request, res: Response) => {
    try {
      const task = await taskService.create(req.user!.tenantId, req.user!.id, req.body)
      res.status(201).json(task)
    } catch (error: any) {
      res.status(error.status || 500).json({ message: error.message || "Internal Server Error" })
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const task = await taskService.update(req.user!.tenantId, req.params.id, req.user!.id, req.body)
      res.json(task)
    } catch (error: any) {
      res.status(error.status || 500).json({ message: error.message || "Internal Server Error" })
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      await taskService.delete(req.user!.tenantId, req.params.id)
      res.status(204).send()
    } catch (error: any) {
      res.status(error.status || 500).json({ message: error.message || "Internal Server Error" })
    }
  },

  list: async (req: Request, res: Response) => {
    if (!req.user?.tenantId) throw { status: 401, message: "Unauthorized: Missing tenant context" }
    try {
      const { status, priority, assignedTo, dealId, leadId, startDate, endDate } = req.query
      const filters = {
        status: status as string,
        priority: priority as string,
        assignedTo: assignedTo as string,
        dealId: dealId as string,
        leadId: leadId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      }

      const tasks = await taskService.list(req.user.tenantId, filters)
      res.json(tasks)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: "Failed to list tasks" })
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const task = await taskService.get(req.user!.tenantId, req.params.id)
      res.json(task)
    } catch (error: any) {
      res.status(error.status || 500).json({ message: error.message || "Internal Server Error" })
    }
  }
}
