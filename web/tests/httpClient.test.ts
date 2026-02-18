import { request } from "../lib/api/httpClient"

describe("httpClient", () => {
  it("throws ApiError on failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "failure" })
    }) as unknown as typeof fetch

    await expect(request("/test", "GET")).rejects.toMatchObject({ status: 500 })
  })
})
