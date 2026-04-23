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

const getColumns = async (client, table) => {
  const rows = await client.$queryRawUnsafe(`
    SELECT column_name, is_nullable, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, table)
  return rows
}

const main = async () => {
  for (const table of tables) {
    const [src, dst] = await Promise.all([getColumns(source, table), getColumns(target, table)])
    console.log(`\n=== ${table} ===`)
    console.log(`source_cols=${src.length} target_cols=${dst.length}`)
    const srcMap = new Map(src.map((c) => [c.column_name, c]))
    const dstMap = new Map(dst.map((c) => [c.column_name, c]))
    const all = [...new Set([...srcMap.keys(), ...dstMap.keys()])]
    for (const col of all) {
      const s = srcMap.get(col)
      const d = dstMap.get(col)
      if (!s || !d) {
        console.log(`ONLY_${s ? "SOURCE" : "TARGET"} ${col}`)
        continue
      }
      if (s.udt_name !== d.udt_name || s.is_nullable !== d.is_nullable) {
        console.log(`DIFF ${col}: src(${s.udt_name}, nullable=${s.is_nullable}) dst(${d.udt_name}, nullable=${d.is_nullable})`)
      }
    }
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
