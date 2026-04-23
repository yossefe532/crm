import { PrismaClient } from "@prisma/client"

const sourceUrl = process.env.SOURCE_DATABASE_URL
const targetUrl = process.env.TARGET_DATABASE_URL

if (!sourceUrl || !targetUrl) {
  console.error("Missing SOURCE_DATABASE_URL or TARGET_DATABASE_URL")
  process.exit(1)
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } })
const target = new PrismaClient({ datasources: { db: { url: targetUrl } } })

const excludedTables = new Set(["_prisma_migrations"])

const getTables = async (client) => {
  const rows = await client.$queryRawUnsafe(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename ASC
  `)
  return rows.map((row) => row.tablename).filter((name) => !excludedTables.has(name))
}

const getCount = async (client, tableName) => {
  const rows = await client.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM "public"."${tableName}"`)
  return Number(rows[0]?.count || 0)
}

const getForeignKeys = async () => {
  const rows = await target.$queryRawUnsafe(`
    SELECT
      tc.table_name AS table_name,
      ccu.table_name AS referenced_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.constraint_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `)
  return rows
}

const sortByDependencies = async (tables) => {
  const tableSet = new Set(tables)
  const fkRows = await getForeignKeys()
  const deps = new Map(tables.map((t) => [t, new Set()]))
  const incoming = new Map(tables.map((t) => [t, 0]))
  const outgoing = new Map(tables.map((t) => [t, new Set()]))

  for (const row of fkRows) {
    const child = row.table_name
    const parent = row.referenced_table
    if (!tableSet.has(child) || !tableSet.has(parent) || child === parent) continue
    if (deps.get(child).has(parent)) continue
    deps.get(child).add(parent)
    incoming.set(child, (incoming.get(child) || 0) + 1)
    outgoing.get(parent).add(child)
  }

  const queue = tables.filter((t) => (incoming.get(t) || 0) === 0)
  const ordered = []
  while (queue.length > 0) {
    const current = queue.shift()
    ordered.push(current)
    for (const child of outgoing.get(current) || []) {
      const next = (incoming.get(child) || 0) - 1
      incoming.set(child, next)
      if (next === 0) queue.push(child)
    }
  }

  if (ordered.length !== tables.length) {
    const unresolved = tables.filter((t) => !ordered.includes(t))
    return [...ordered, ...unresolved]
  }
  return ordered
}

const truncateTables = async (tables) => {
  if (tables.length === 0) return
  const list = tables.map((t) => `"public"."${t}"`).join(", ")
  await target.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

const copyTable = async (tableName) => {
  const sourceRows = await source.$queryRawUnsafe(`
    SELECT COALESCE(json_agg(t), '[]'::json) AS data
    FROM (SELECT * FROM "public"."${tableName}") t
  `)
  const payload = sourceRows[0]?.data
  if (!Array.isArray(payload) || payload.length === 0) {
    return 0
  }
  await target.$executeRawUnsafe(`
    INSERT INTO "public"."${tableName}"
    SELECT *
    FROM json_populate_recordset(NULL::"public"."${tableName}", $1::json)
  `, JSON.stringify(payload))
  return payload.length
}

const main = async () => {
  await source.$queryRawUnsafe("SELECT 1")
  await target.$queryRawUnsafe("SELECT 1")

  const sourceTables = await getTables(source)
  const targetTables = await getTables(target)
  const sourceSet = new Set(sourceTables)
  const common = targetTables.filter((table) => sourceSet.has(table))
  const orderedCommon = await sortByDependencies(common)

  console.log(`source tables=${sourceTables.length}, target tables=${targetTables.length}, common=${common.length}`)
  console.log("Truncating target tables...")
  await truncateTables(targetTables)
  console.log("Target truncated")

  for (const table of orderedCommon) {
    const copied = await copyTable(table)
    if (copied > 0) {
      console.log(`Copied ${table}: ${copied}`)
    }
  }

  let mismatch = 0
  for (const table of common) {
    const [src, dst] = await Promise.all([getCount(source, table), getCount(target, table)])
    if (src !== dst) {
      mismatch += 1
      console.log(`DIFF ${table}: source=${src} target=${dst}`)
    }
  }

  for (const table of targetTables.filter((table) => !sourceSet.has(table))) {
    const dst = await getCount(target, table)
    if (dst !== 0) {
      mismatch += 1
      console.log(`DIFF extra-table ${table}: source=0 target=${dst}`)
    }
  }

  if (mismatch > 0) {
    console.log(`MISMATCH_TABLES=${mismatch}`)
    process.exitCode = 1
    return
  }

  console.log("EXACT_SYNC_OK")
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
