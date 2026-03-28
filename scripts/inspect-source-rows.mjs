import { PrismaClient } from "@prisma/client"

const sourceUrl = process.env.SOURCE_DATABASE_URL
if (!sourceUrl) {
  console.error("Missing SOURCE_DATABASE_URL")
  process.exit(1)
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } })
const tables = [
  "audit_logs",
  "discipline_index_snapshots",
  "lead_metrics_daily",
  "lead_scores",
  "notification_deliveries"
]

const main = async () => {
  for (const table of tables) {
    const rows = await source.$queryRawUnsafe(`
      SELECT row_to_json(t) AS row
      FROM (SELECT * FROM "public"."${table}" LIMIT 1) t
    `)
    console.log(`TABLE=${table}`)
    console.log(JSON.stringify(rows[0]?.row || null))
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await source.$disconnect()
  })
