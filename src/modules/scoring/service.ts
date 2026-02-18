import { intelligenceService } from "../intelligence/service"

export const scoringService = {
  scoreLead: async (tenantId: string, leadId: string) => {
    return intelligenceService.scoreLead(tenantId, leadId)
  }
}
