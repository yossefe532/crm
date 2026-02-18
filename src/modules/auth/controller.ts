import { Request, Response } from "express"
import { authService } from "./service"
import { isValidEmail, validatePasswordStrength } from "./validation"

export const authController = {
  login: async (req: Request, res: Response) => {
    const email = String(req.body?.email || "")
    const password = String(req.body?.password || "")
    if (!isValidEmail(email)) throw { status: 400, message: "صيغة البريد الإلكتروني غير صحيحة" }
    if (!password) throw { status: 400, message: "كلمة المرور مطلوبة" }
    const result = await authService.login({ email, password })
    res.json(result)
  },

  register: async (req: Request, res: Response) => {
    const tenantName = String(req.body?.tenantName || "").trim()
    const timezone = req.body?.timezone ? String(req.body.timezone) : undefined
    const email = String(req.body?.email || "")
    const password = String(req.body?.password || "")
    const phone = req.body?.phone ? String(req.body.phone) : undefined

    if (!tenantName) throw { status: 400, message: "اسم الشركة/العميل مطلوب" }
    if (!isValidEmail(email)) throw { status: 400, message: "صيغة البريد الإلكتروني غير صحيحة" }
    const strength = validatePasswordStrength(password)
    if (!strength.ok) throw { status: 400, message: strength.reasons[0] || "كلمة المرور ضعيفة" }

    const result = await authService.register({ tenantName, timezone, email, password, phone })
    res.json(result)
  },

  me: async (req: Request, res: Response) => {
    if (req.user?.forceReset) throw { status: 403, message: "يجب تغيير كلمة المرور أولاً" }
    const result = await authService.me(req.user as any)
    res.json({ user: result })
  },

  changePassword: async (req: Request, res: Response) => {
    const currentPassword = String(req.body?.currentPassword || "")
    const newPassword = String(req.body?.newPassword || "")
    const confirmPassword = String(req.body?.confirmPassword || "")
    if (!currentPassword) throw { status: 400, message: "كلمة المرور الحالية مطلوبة" }
    if (!newPassword) throw { status: 400, message: "كلمة المرور الجديدة مطلوبة" }
    if (newPassword !== confirmPassword) throw { status: 400, message: "تأكيد كلمة المرور غير مطابق" }
    const strength = validatePasswordStrength(newPassword)
    if (!strength.ok) throw { status: 400, message: strength.reasons[0] || "كلمة المرور ضعيفة" }
    const result = await authService.changePassword(req.user as any, { currentPassword, newPassword })
    res.json(result)
  },
  updateProfile: async (req: Request, res: Response) => {
    const currentPassword = String(req.body?.currentPassword || "")
    const email = req.body?.email ? String(req.body.email) : undefined
    const phone = req.body?.phone ? String(req.body.phone) : undefined
    if (!currentPassword) throw { status: 400, message: "كلمة المرور الحالية مطلوبة" }
    if (email && !isValidEmail(email)) throw { status: 400, message: "صيغة البريد الإلكتروني غير صحيحة" }
    const result = await authService.updateProfile(req.user as any, { currentPassword, email, phone })
    res.json(result)
  }
}
