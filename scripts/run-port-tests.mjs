import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const root = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(root, "..")

const vitestMjs = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs")

const child = spawn(process.execPath, [vitestMjs, "--run", "tests/ports.e2e.test.ts"], {
  cwd: projectRoot,
  env: { ...process.env, RUN_PORT_TESTS: "1" },
  stdio: "inherit"
})

child.on("exit", (code) => process.exit(code ?? 1))
