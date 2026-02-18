/*
  Warnings:

  - A unique constraint covering the columns `[tenant_id,phone]` on the table `leads` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,name]` on the table `teams` will be added. If there are existing duplicate values, this will fail.
  - Made the column `phone` on table `leads` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "lead_closures" ADD COLUMN     "decided_at" TIMESTAMP(3),
ADD COLUMN     "decided_by" UUID,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "leads" ALTER COLUMN "phone" SET NOT NULL;

-- CreateTable
CREATE TABLE "icon_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "icon_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_targets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "target_value" DECIMAL(14,2) NOT NULL,
    "weight" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_quota" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day_key" TEXT NOT NULL,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_quota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "entityType" TEXT,
    "entityId" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT,
    "contentType" TEXT NOT NULL DEFAULT 'text',
    "media_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readBy" JSONB,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "icon_assets_tenant_id_entity_type_entity_id_idx" ON "icon_assets"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "icon_assets_tenant_id_created_by_idx" ON "icon_assets"("tenant_id", "created_by");

-- CreateIndex
CREATE INDEX "icon_assets_tenant_id_url_idx" ON "icon_assets"("tenant_id", "url");

-- CreateIndex
CREATE INDEX "goal_plans_tenant_id_period_idx" ON "goal_plans"("tenant_id", "period");

-- CreateIndex
CREATE INDEX "goal_plans_tenant_id_status_idx" ON "goal_plans"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "goal_targets_tenant_id_plan_id_idx" ON "goal_targets"("tenant_id", "plan_id");

-- CreateIndex
CREATE INDEX "goal_targets_tenant_id_subject_type_subject_id_idx" ON "goal_targets"("tenant_id", "subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "goal_targets_tenant_id_metric_key_idx" ON "goal_targets"("tenant_id", "metric_key");

-- CreateIndex
CREATE INDEX "notification_quota_tenant_id_day_key_idx" ON "notification_quota"("tenant_id", "day_key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_quota_tenant_id_user_id_day_key_key" ON "notification_quota"("tenant_id", "user_id", "day_key");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_type_idx" ON "conversations"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "conversations_tenant_id_entityType_entityId_idx" ON "conversations"("tenant_id", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "conversation_participants_tenant_id_conversation_id_idx" ON "conversation_participants"("tenant_id", "conversation_id");

-- CreateIndex
CREATE INDEX "conversation_participants_tenant_id_user_id_idx" ON "conversation_participants"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "messages_tenant_id_conversation_id_idx" ON "messages"("tenant_id", "conversation_id");

-- CreateIndex
CREATE INDEX "messages_tenant_id_sender_id_idx" ON "messages"("tenant_id", "sender_id");

-- CreateIndex
CREATE INDEX "messages_tenant_id_created_at_idx" ON "messages"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_closures_tenant_id_status_idx" ON "lead_closures"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "leads_tenant_id_name_idx" ON "leads"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "leads_tenant_id_email_idx" ON "leads"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_tenant_id_phone_key" ON "leads"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "teams_tenant_id_name_key" ON "teams"("tenant_id", "name");

-- AddForeignKey
ALTER TABLE "icon_assets" ADD CONSTRAINT "icon_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icon_assets" ADD CONSTRAINT "icon_assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_closures" ADD CONSTRAINT "lead_closures_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_plans" ADD CONSTRAINT "goal_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_targets" ADD CONSTRAINT "goal_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_targets" ADD CONSTRAINT "goal_targets_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "goal_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_quota" ADD CONSTRAINT "notification_quota_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_quota" ADD CONSTRAINT "notification_quota_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
