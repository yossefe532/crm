import { z } from "zod"

export const createLeadSchema = z.object({
  leadCode: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(8, "Phone number is too short"),
  email: z.string().email().optional().or(z.literal("")),
  sourceId: z.string().uuid().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  budget: z.number().min(0).optional(),
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  propertyType: z.string().optional(),
  areaOfInterest: z.string().optional(),
  desiredLocation: z.string().optional(),
  assignedUserId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional()
})

export const updateLeadSchema = createLeadSchema.partial().extend({
  status: z.string().optional(),
  assignedUserId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional()
})

export const assignLeadSchema = z.object({
  userId: z.string().uuid(),
  teamId: z.string().uuid().optional()
})
