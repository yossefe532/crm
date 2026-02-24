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
    try {
      const filters = {
        assignedUserId: req.query.assignedUserId as string,
        status: req.query.status as string,
        relatedType: req.query.relatedType as string,
        relatedId: req.query.relatedId as string,
        createdByUserId: req.query.createdByUserId as string
      }
      const tasks = await taskService.list(req.user!.tenantId, filters)
      res.json(tasks)
    } catch (error: any) {
      res.status(error.status || 500).json({ message: error.message || "Internal Server Error" })
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
