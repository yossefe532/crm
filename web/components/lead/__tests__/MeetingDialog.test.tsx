import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MeetingDialog } from "../MeetingDialog"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("../../../lib/auth/AuthContext", () => ({
  useAuth: () => ({ token: "TEST_TOKEN", role: "sales", userId: "u1", tenantId: "t1", forceReset: false })
}))

vi.mock("../../../lib/services/leadService", () => {
  return {
    leadService: {
      createMeeting: vi.fn(async () => ({ id: "m1" }))
    }
  }
})

const setup = (props?: Partial<Parameters<typeof MeetingDialog>[0]>) => {
  const queryClient = new QueryClient()
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <MeetingDialog isOpen={true} onClose={onClose} leadId="L1" initialTitle="اجتماع مخصص" {...props} />
    </QueryClientProvider>
  )
  return { onClose, queryClient, invalidateSpy }
}

describe("MeetingDialog", () => {
  it("يعرض القيم الابتدائية ويمنع الحفظ بدون وقت بدء", async () => {
    setup()
    expect(screen.getByLabelText("عنوان الاجتماع")).toHaveValue("اجتماع مخصص")
    const saveBtn = screen.getByRole("button", { name: "حفظ الاجتماع" })
    expect(saveBtn).toBeDisabled()
  })

  it("ينفذ إنشاء الاجتماع ويغلق ويحدّث الاستعلامات", async () => {
    const { onClose, invalidateSpy } = setup()
    const titleInput = screen.getByLabelText("عنوان الاجتماع")
    const startInput = screen.getByLabelText("تاريخ ووقت البدء")
    const durationInput = screen.getByLabelText("المدة (دقيقة)")

    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, "اجتماع تجربة")
    await userEvent.type(startInput, "2026-02-17T10:00")
    await userEvent.clear(durationInput)
    await userEvent.type(durationInput, "90")

    const saveBtn = screen.getByRole("button", { name: "حفظ الاجتماع" })
    expect(saveBtn).not.toBeDisabled()
    await userEvent.click(saveBtn)

    const { leadService } = await import("../../../lib/services/leadService")
    expect(leadService.createMeeting).toHaveBeenCalled()

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalled()
  })

  it("يعيد تعيين العنوان عند الفتح مجددًا", async () => {
    const onClose = vi.fn()
    const queryClient = new QueryClient()
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MeetingDialog isOpen={true} onClose={onClose} leadId="L1" initialTitle="عنوان 1" />
      </QueryClientProvider>
    )
    const titleInput = screen.getByLabelText("عنوان الاجتماع")
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, "عنوان مؤقت")
    const { act } = await import("react")
    await act(async () => {
      rerender(
      <QueryClientProvider client={queryClient}>
        <MeetingDialog isOpen={false} onClose={onClose} leadId="L1" initialTitle="عنوان 2" />
      </QueryClientProvider>
    )
      rerender(
      <QueryClientProvider client={queryClient}>
        <MeetingDialog isOpen={true} onClose={onClose} leadId="L1" initialTitle="عنوان 2" />
      </QueryClientProvider>
    )
    })
    expect(screen.getByLabelText("عنوان الاجتماع")).toHaveValue("عنوان 2")
  })
})
