import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

function rootDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
}

describe("Dev proxy + CSP", () => {
  it("sets apiBaseUrl default to /api", () => {
    const root = rootDir()
    const clientTs = fs.readFileSync(path.join(root, "web", "lib", "api", "client.ts"), "utf8")
    expect(clientTs).toContain('process.env.NEXT_PUBLIC_API_BASE_URL || "/api"')
  })

  it("has a /api rewrite to backend origin", () => {
    const root = rootDir()
    const nextConfig = fs.readFileSync(path.join(root, "web", "next.config.mjs"), "utf8")
    expect(nextConfig).toContain('source: "/api/:path*"')
    expect(nextConfig).toContain('destination: `${backendOrigin}/api/:path*`')
  })

  it("allows ws/wss and localhost:4000 in connect-src for dev", () => {
    const root = rootDir()
    const nextConfig = fs.readFileSync(path.join(root, "web", "next.config.mjs"), "utf8")
    expect(nextConfig).toContain("ws: wss:")
    expect(nextConfig).toContain("http://localhost:4000")
    expect(nextConfig).toContain("http://127.0.0.1:4000")
  })
})

