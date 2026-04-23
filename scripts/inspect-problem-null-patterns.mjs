import { PrismaClient } from "@prisma/client"

const sourceUrl = process.env.SOURCE_DATABASE_URL
if (!sourceUrl) {
  console.error("Missing SOURCE_DATABASE_URL")
  process.exit(1)
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } })

const main = async () => {
  const q1 = await source.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END)::int AS user_id_nulls,
      SUM(CASE WHEN actor_user_id IS NULL THEN 1 ELSE 0 END)::int AS actor_user_id_nulls,
      SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END)::int AS tenant_id_nulls,
      SUM(CASE WHEN created_at IS NULL THEN 1 ELSE 0 END)::int AS created_at_nulls
    FROM audit_logs
  `)
  console.log("audit_logs", q1[0])

  const q2 = await source.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN date IS NULL THEN 1 ELSE 0 END)::int AS date_nulls,
      SUM(CASE WHEN details IS NULL THEN 1 ELSE 0 END)::int AS details_nulls
    FROM discipline_index_snapshots
  `)
  console.log("discipline_index_snapshots", q2[0])

  const q3 = await source.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN date IS NULL THEN 1 ELSE 0 END)::int AS date_nulls,
      SUM(CASE WHEN new_leads_count IS NULL THEN 1 ELSE 0 END)::int AS new_leads_count_nulls,
      SUM(CASE WHEN calls_count IS NULL THEN 1 ELSE 0 END)::int AS calls_count_nulls,
      SUM(CASE WHEN meetings_count IS NULL THEN 1 ELSE 0 END)::int AS meetings_count_nulls,
      SUM(CASE WHEN closings_count IS NULL THEN 1 ELSE 0 END)::int AS closings_count_nulls,
      SUM(CASE WHEN revenue_amount IS NULL THEN 1 ELSE 0 END)::int AS revenue_amount_nulls
    FROM lead_metrics_daily
  `)
  console.log("lead_metrics_daily", q3[0])

  const q4 = await source.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN score IS NULL THEN 1 ELSE 0 END)::int AS score_nulls,
      SUM(CASE WHEN factors IS NULL THEN 1 ELSE 0 END)::int AS factors_nulls
    FROM lead_scores
  `)
  console.log("lead_scores", q4[0])

  const q5 = await source.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END)::int AS user_id_nulls,
      SUM(CASE WHEN type IS NULL THEN 1 ELSE 0 END)::int AS type_nulls,
      SUM(CASE WHEN title IS NULL THEN 1 ELSE 0 END)::int AS title_nulls,
      SUM(CASE WHEN message IS NULL THEN 1 ELSE 0 END)::int AS message_nulls,
      SUM(CASE WHEN created_at IS NULL THEN 1 ELSE 0 END)::int AS created_at_nulls
    FROM notification_deliveries
  `)
  console.log("notification_deliveries", q5[0])
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await source.$disconnect()
  })
