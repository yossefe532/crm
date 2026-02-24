-- AlterTable
ALTER TABLE "goal_plans" ADD COLUMN     "is_pinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "goal_targets" ADD COLUMN     "achieved_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "is_wrong_number" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_notification_clear_time" TIMESTAMP(3);
