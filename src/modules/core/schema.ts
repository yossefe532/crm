import { z } from "zod"

export const createUserSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  email: z.string().email("صيغة البريد الإلكتروني غير صحيحة"),
  phone: z.string().optional().or(z.literal("")),
  password: z.string().optional(),
  role: z.enum(["team_leader", "sales"], { message: "نوع الدور غير صالح" }),
  teamId: z.string().uuid().optional(),
  teamName: z.string().optional()
})

export const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("صيغة البريد الإلكتروني غير صحيحة").optional(),
  phone: z.string().optional().or(z.literal("")),
  status: z.string().optional()
})
