import process from "node:process"

const email = String(process.env.OWNER_EMAIL || "y@gmail.com").trim().toLowerCase()
const password = String(process.env.OWNER_PASSWORD || "123456789")
const base = String(process.env.BACKEND_ORIGIN || "http://localhost:4000")

const url = `${base}/api/auth/login`

async function main() {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${text}`)
  }
  const data = JSON.parse(text)
  if (!data?.token) throw new Error("Login succeeded but token is missing")
  console.log(JSON.stringify({ ok: true, url, user: data.user }, null, 2))
}

main().catch((err) => {
  console.error("FAILED", err?.message || err)
  process.exitCode = 1
})

