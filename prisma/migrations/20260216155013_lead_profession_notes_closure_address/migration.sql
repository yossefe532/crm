-- AlterTable
ALTER TABLE "lead_closures" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "profession" TEXT;
