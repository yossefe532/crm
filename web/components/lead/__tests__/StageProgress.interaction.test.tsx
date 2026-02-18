import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StageProgress } from "../StageProgress"
import { LocaleProvider } from "../../../lib/i18n/LocaleContext"

describe("StageProgress interaction", () => {
  it("ينفّذ onStageChange عند الضغط على مرحلة الاجتماع", async () => {
    const onStageChange = vi.fn()
    render(
      <LocaleProvider>
        <StageProgress stage="call" onStageChange={onStageChange} />
      </LocaleProvider>
    )
    const meetingBtn = screen.getByRole("button", { name: "اجتماع" })
    await userEvent.click(meetingBtn)
    expect(onStageChange).toHaveBeenCalledWith("meeting")
  })
})
