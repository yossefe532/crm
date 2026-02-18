import { UserPayload } from "../utils/auth"

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload
    }
  }
}

export {}
