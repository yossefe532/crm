export interface SmsService {
  send(to: string, message: string): Promise<void>
}

export const logSmsService: SmsService = {
  send: async (to: string, message: string) => {
    console.log(`[SMS] To: ${to}, Message: ${message}`)
  }
}

// In a real app, we would switch implementation based on env config
export const smsService = logSmsService
