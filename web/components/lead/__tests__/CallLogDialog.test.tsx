import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CallLogDialog } from "../CallLogDialog"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("../../../lib/auth/AuthContext", () => ({
  useAuth: () => ({ token: "TEST_TOKEN", role: "sales", userId: "u1", tenantId: "t1", forceReset: false })
}))

vi.mock("../../../lib/services/leadService", () => {
  return {
    leadService: {
      addCall: vi.fn(async () => ({ id: "c1" }))
    }
  }
})

const setup = () => {
  const queryClient = new QueryClient()
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <CallLogDialog isOpen={true} onClose={onClose} leadId="L1" phone="+201234567890" />
    </QueryClientProvider>
  )
  return { onClose, invalidateSpy }
}

describe("CallLogDialog", () => {
  it("يحفظ نتيجة المكالمة ويغلق ويحدّث الاستعلامات", async () => {
    const { onClose, invalidateSpy } = setup()
    const outcomeSelect = screen.getByLabelText("نتيجة المكالمة")
    const durationInput = screen.getByLabelText("المدة (ثواني)")

    await userEvent.selectOptions(outcomeSelect, "no_answer")
    await userEvent.clear(durationInput)
    await userEvent.type(durationInput, "30")

    const saveBtn = screen.getByRole("button", { name: "حفظ النتيجة" })
    await userEvent.click(saveBtn)

    const { leadService } = await import("../../../lib/services/leadService")
    expect(leadService.addCall).toHaveBeenCalledWith("L1", { outcome: "no_answer", durationSeconds: 30 }, "TEST_TOKEN")

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalled()
  })
})
