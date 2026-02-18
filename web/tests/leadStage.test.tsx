import { render, screen } from "@testing-library/react"
import { StageProgress } from "../components/lead/StageProgress"
import { LocaleProvider } from "../lib/i18n/LocaleContext"

describe("StageProgress", () => {
  it("renders stage badges", () => {
    render(
      <LocaleProvider>
        <StageProgress stage="call" />
      </LocaleProvider>
    )
    expect(screen.getByText("مكالمة هاتفية")).toBeInTheDocument()
  })
})
