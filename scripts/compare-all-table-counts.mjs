import { PrismaClient } from "@prisma/client"

const sourceUrl = process.env.SOURCE_DATABASE_URL
const targetUrl = process.env.TARGET_DATABASE_URL

if (!sourceUrl || !targetUrl) {
  console.error("Missing SOURCE_DATABASE_URL or TARGET_DATABASE_URL")
  process.exit(1)
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } })
const target = new PrismaClient({ datasources: { db: { url: targetUrl } } })

const getTables = async (client) => {
  const rows = await client.$queryRawUnsafe(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename ASC
  `)
  return rows.map((row) => row.tablename).filter((name) => name !== "_prisma_migrations")
}

const getCount = async (client, tableName) => {
  const rows = await client.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM "public"."${tableName}"`)
  return Number(rows[0]?.count || 0)
}

const main = async () => {
  const sourceTables = await getTables(source)
  const targetTables = await getTables(target)
  const sourceSet = new Set(sourceTables)
  const targetSet = new Set(targetTables)
  const common = targetTables.filter((table) => sourceSet.has(table))

  let mismatches = 0
  for (const table of common) {
    const [src, dst] = await Promise.all([getCount(source, table), getCount(target, table)])
    if (src !== dst) {
      mismatches += 1
      console.log(`DIFF ${table}: source=${src} target=${dst}`)
    }
  }

  console.log(`COMMON_TABLES=${common.length}`)
  console.log(`MISMATCH_TABLES=${mismatches}`)

  const onlyInSource = sourceTables.filter((table) => !targetSet.has(table))
  const onlyInTarget = targetTables.filter((table) => !sourceSet.has(table))
  if (onlyInSource.length > 0) {
    console.log(`ONLY_IN_SOURCE=${onlyInSource.join(",")}`)
  }
  if (onlyInTarget.length > 0) {
    console.log(`ONLY_IN_TARGET=${onlyInTarget.join(",")}`)
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
