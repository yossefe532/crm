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
  "audit_logs",
  "discipline_index_snapshots",
  "lead_metrics_daily",
  "lead_scores",
  "notification_deliveries"
]

const ensureRejectsTable = async () => {
  await target.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "public"."migration_rejects" (
      "id" BIGSERIAL PRIMARY KEY,
      "table_name" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "reason" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

const readRows = async (table) => {
  const rows = await source.$queryRawUnsafe(`
    SELECT COALESCE(json_agg(t), '[]'::json) AS data
    FROM (SELECT * FROM "public"."${table}") t
  `)
  const payload = rows[0]?.data
  return Array.isArray(payload) ? payload : []
}

const insertBulk = async (table, payload) => {
  await target.$executeRawUnsafe(`
    INSERT INTO "public"."${table}"
    SELECT *
    FROM json_populate_recordset(NULL::"public"."${table}", $1::json)
    ON CONFLICT DO NOTHING
  `, JSON.stringify(payload))
}

const insertRejected = async (table, row, error) => {
  const reason = error instanceof Error ? error.message.slice(0, 1800) : String(error).slice(0, 1800)
  await target.$executeRawUnsafe(
    `INSERT INTO "public"."migration_rejects" ("table_name", "payload", "reason") VALUES ($1, $2::jsonb, $3)`,
    table,
    JSON.stringify(row),
    reason
  )
}

const copyWithFallback = async (table) => {
  const payload = await readRows(table)
  if (payload.length === 0) {
    console.log(`${table}: no rows`)
    return
  }
  try {
    await insertBulk(table, payload)
    console.log(`${table}: copied ${payload.length} (bulk)`)
    return
  } catch {
    let copied = 0
    let rejected = 0
    for (let i = 0; i < payload.length; i += 1) {
      const row = payload[i]
      try {
        await insertBulk(table, [row])
        copied += 1
      } catch (error) {
        rejected += 1
        await insertRejected(table, row, error)
      }
      if ((i + 1) % 1000 === 0) {
        console.log(`${table}: processed ${i + 1}/${payload.length}`)
      }
    }
    console.log(`${table}: copied ${copied}, rejected ${rejected} (row fallback)`)
  }
}

const main = async () => {
  await source.$queryRawUnsafe("SELECT 1")
  await target.$queryRawUnsafe("SELECT 1")
  await ensureRejectsTable()

  for (const table of tables) {
    await copyWithFallback(table)
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
