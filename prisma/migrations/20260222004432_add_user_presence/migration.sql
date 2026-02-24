-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_seen" TIMESTAMP(3);
