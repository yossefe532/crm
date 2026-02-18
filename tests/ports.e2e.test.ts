import { describe, expect, it } from "vitest"
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"

function projectRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
}

describe("Ports: frontend 3000, backend 4000", () => {
  it("locks frontend to 3000 via web/package.json scripts", async () => {
    if (process.env.RUN_PORT_TESTS !== "1") return

    const root = projectRoot()
    const webPackageJsonPath = path.join(root, "web", "package.json")
    const webPackageJson = JSON.parse(fs.readFileSync(webPackageJsonPath, "utf8")) as {
      scripts?: Record<string, string>
    }

    expect(webPackageJson.scripts?.dev).toContain("next dev")
    expect(webPackageJson.scripts?.dev).toContain("-p 3000")
    expect(webPackageJson.scripts?.start).toContain("next start")
    expect(webPackageJson.scripts?.start).toContain("-p 3000")
  })

  it("locks backend default port to 4000 in env config", async () => {
    if (process.env.RUN_PORT_TESTS !== "1") return

    const root = projectRoot()
    const envConfig = fs.readFileSync(path.join(root, "src", "config", "env.ts"), "utf8")
    expect(envConfig).toContain("process.env.PORT || 4000")
  })

  it("locks frontend default API base to backend port 4000", async () => {
    if (process.env.RUN_PORT_TESTS !== "1") return

    const root = projectRoot()
    const clientTs = fs.readFileSync(path.join(root, "web", "lib", "api", "client.ts"), "utf8")
    expect(clientTs).toContain("http://localhost:4000/api")
  })

  it("enforces 3000/4000 in start-all launcher", async () => {
    if (process.env.RUN_PORT_TESTS !== "1") return

    const root = projectRoot()
    const startAll = fs.readFileSync(path.join(root, "start-all.ps1"), "utf8")
    expect(startAll).toContain("$backendPort = 4000")
    expect(startAll).toContain("$frontendPort = 3000")
    expect(startAll).toContain("Test-PortInUse -Port $frontendPort")
    expect(startAll).toContain("Test-PortInUse -Port $backendPort")
    expect(startAll).toContain("`$env:PORT = '$frontendPort'")
  })
})

