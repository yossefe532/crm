import { PrismaClient } from "@prisma/client"

const sourceUrl = process.env.SOURCE_DATABASE_URL
const targetUrl = process.env.TARGET_DATABASE_URL

if (!sourceUrl || !targetUrl) {
  console.error("Missing SOURCE_DATABASE_URL or TARGET_DATABASE_URL")
  process.exit(1)
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } })
const target = new PrismaClient({ datasources: { db: { url: targetUrl } } })

const tables = [
  "tenants",
  "users",
  "roles",
  "permissions",
  "user_roles",
  "leads",
  "lead_assignments",
  "lead_deadlines",
  "lead_failures",
  "lead_state_history",
  "call_logs",
  "conversations",
  "conversation_participants",
  "negligence_points",
  "tasks",
  "meetings",
  "notifications"
]

const count = async (client, table) => {
  const rows = await client.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "public"."${table}"`)
  return Number(rows[0]?.count || 0)
}

const main = async () => {
  for (const table of tables) {
    const [src, dst] = await Promise.all([count(source, table), count(target, table)])
    console.log(`${table}: source=${src} target=${dst}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await source.$disconnect()
    await target.$disconnect()
  })
