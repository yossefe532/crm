import { Request, Response, NextFunction } from "express"
import { z } from "zod"

export const validate = (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = schema.parse(req.body)
    next()
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = (error as unknown as { issues?: Array<{ path: Array<string | number>; message: string }>; errors?: Array<{ path: Array<string | number>; message: string }> }).issues
        || (error as unknown as { errors?: Array<{ path: Array<string | number>; message: string }> }).errors
        || []
      const details = issues.map((item) => ({
        path: item.path.join("."),
        message: item.message
      }))
      return res.status(400).json({
        error: "خطأ في التحقق من البيانات",
        message: details[0]?.message || "بيانات غير صالحة",
        details
      })
    }
    next(error)
  }
}
