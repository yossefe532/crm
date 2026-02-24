-- AlterTable
ALTER TABLE "conversation_participants" ADD COLUMN     "last_read_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "last_read_at" TIMESTAMP(3);
