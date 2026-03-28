import { PrismaClient } from "@prisma/client"

const sourceUrl = process.env.SOURCE_DATABASE_URL
const targetUrl = process.env.TARGET_DATABASE_URL

if (!sourceUrl || !targetUrl) {
  console.error("Missing SOURCE_DATABASE_URL or TARGET_DATABASE_URL")
  process.exit(1)
}

const source = new PrismaClient({
  datasources: {
    db: { url: sourceUrl }
  }
})

const target = new PrismaClient({
  datasources: {
    db: { url: targetUrl }
  }
})

const excludedTables = new Set(["_prisma_migrations"])

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
  const rows = await client.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "public"."${tableName}"`)
  return Number(rows[0]?.count || 0)
}

const copyTable = async (tableName) => {
  const sourceRows = await source.$queryRawUnsafe(`
    SELECT COALESCE(json_agg(t), '[]'::json) AS data
    FROM (SELECT * FROM "public"."${tableName}") t
  `)
  const payload = sourceRows[0]?.data
  const itemsCount = Array.isArray(payload) ? payload.length : 0
  if (!itemsCount) {
    return { copied: 0, skipped: true }
  }

  try {
    await target.$executeRawUnsafe(`
      INSERT INTO "public"."${tableName}"
      SELECT *
      FROM json_populate_recordset(NULL::"public"."${tableName}", $1::json)
      ON CONFLICT DO NOTHING
    `, JSON.stringify(payload))
    return { copied: itemsCount, rejected: 0, skipped: false }
  } catch (bulkError) {
    let copied = 0
    let rejected = 0
    for (const row of payload) {
      try {
        await target.$executeRawUnsafe(`
          INSERT INTO "public"."${tableName}"
          SELECT *
          FROM json_populate_recordset(NULL::"public"."${tableName}", $1::json)
          ON CONFLICT DO NOTHING
        `, JSON.stringify([row]))
        copied += 1
      } catch (rowError) {
        rejected += 1
        const reason = rowError instanceof Error ? rowError.message.slice(0, 1800) : String(rowError).slice(0, 1800)
        await target.$executeRawUnsafe(
          `INSERT INTO "public"."migration_rejects" ("table_name", "payload", "reason") VALUES ($1, $2::jsonb, $3)`,
          tableName,
          JSON.stringify(row),
          reason
        )
      }
    }
    return { copied, rejected, skipped: false, fallback: true, bulkError }
  }
}

const main = async () => {
  console.log("Checking connectivity...")
  await source.$queryRawUnsafe("SELECT 1")
  await target.$queryRawUnsafe("SELECT 1")
  await ensureRejectsTable()
  console.log("Connectivity OK")

  const targetTables = await getTables(target)
  const sourceTablesSet = new Set(await getTables(source))
  const tables = targetTables.filter((table) => sourceTablesSet.has(table))
  const missingInSource = targetTables.filter((table) => !sourceTablesSet.has(table))
  console.log(`Found ${tables.length} transferable tables`)
  if (missingInSource.length > 0) {
    console.log(`Skipped ${missingInSource.length} tables not present in source`)
  }

  const initialTargetCounts = new Map()
  for (const table of tables) {
    initialTargetCounts.set(table, await getCount(target, table))
  }

  let pending = [...tables]
  let pass = 1
  const maxPasses = 12
  const failed = new Map()

  while (pending.length > 0 && pass <= maxPasses) {
    console.log(`Pass ${pass}: pending ${pending.length}`)
    const nextPending = []
    let progressed = 0

    for (const table of pending) {
      try {
        const result = await copyTable(table)
        failed.delete(table)
        progressed += 1
        if (!result.skipped) {
          const rejectedInfo = result.rejected ? `, rejected=${result.rejected}` : ""
          const fallbackInfo = result.fallback ? " (row-fallback)" : ""
          console.log(`Copied ${table}: ${result.copied}${rejectedInfo}${fallbackInfo}`)
        }
      } catch (error) {
        failed.set(table, error instanceof Error ? error.message : String(error))
        nextPending.push(table)
      }
    }

    if (progressed === 0) {
      break
    }

    pending = nextPending
    pass += 1
  }

  console.log("Verification:")
  let mismatchCount = 0
  for (const table of tables) {
    const sourceCount = await getCount(source, table)
    const targetCount = await getCount(target, table)
    const beforeCount = initialTargetCounts.get(table) || 0
    if (targetCount < sourceCount && targetCount === beforeCount) {
      mismatchCount += 1
      console.log(`Mismatch ${table}: source=${sourceCount}, target=${targetCount}, before=${beforeCount}`)
    }
  }

  if (pending.length > 0 || mismatchCount > 0) {
    console.log("Failed tables:")
    for (const table of pending) {
      console.log(`- ${table}: ${failed.get(table) || "unknown error"}`)
    }
    process.exitCode = 1
    return
  }

  console.log("Transfer completed successfully")
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
