-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "avatar_file_id" UUID,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "leader_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'tenant',
    "parent_role_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "module_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_by" UUID,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "manifest" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_permissions" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_event_subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "handler_ref" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_event_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "primary_email" TEXT,
    "primary_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_channels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "channel_type" TEXT NOT NULL,
    "channel_value" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "budget" DECIMAL(14,2),
    "area_of_interest" TEXT,
    "source_label" TEXT,
    "source_id" UUID,
    "assigned_user_id" UUID,
    "team_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "budget_min" DECIMAL(14,2),
    "budget_max" DECIMAL(14,2),
    "desired_location" TEXT,
    "property_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'primary',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_tags" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_tag_links" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "assigned_user_id" UUID NOT NULL,
    "assigned_by" UUID,
    "reason" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activity_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "activity_type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "task_type" TEXT NOT NULL,
    "due_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "caller_user_id" UUID,
    "call_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_seconds" INTEGER,
    "outcome" TEXT,
    "recording_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_state_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "sla_hours" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_state_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_state_transitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "from_state_id" UUID NOT NULL,
    "to_state_id" UUID NOT NULL,
    "guard_key" TEXT,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_state_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_state_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_state_id" UUID,
    "to_state_id" UUID NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "lead_state_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_deadlines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_extensions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "requested_by" UUID,
    "approved_by" UUID,
    "reason" TEXT,
    "extension_hours" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "lead_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_failures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "failed_by" UUID,
    "failure_type" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "lead_failures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_closures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "closed_by" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "request_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entry_type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "owner_contact_id" UUID,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "property_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_units" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "unit_code" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "size_sqm" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "unit_id" UUID,
    "listing_type" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_media" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "inquiry_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'negotiation',
    "deal_value" DECIMAL(14,2),
    "status" TEXT NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "organizer_user_id" UUID,
    "title" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_participants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "participant_type" TEXT NOT NULL,
    "participant_ref_id" UUID NOT NULL,
    "response_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_rooms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_reschedule_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "requested_by" UUID,
    "proposed_starts_at" TIMESTAMP(3) NOT NULL,
    "proposed_ends_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_reschedule_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_reminders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reassignment_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_key" TEXT NOT NULL,
    "conditions" JSONB,
    "action" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reassignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reassignment_pools" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reassignment_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pool_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negligence_points" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negligence_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reassignment_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_user_id" UUID,
    "to_user_id" UUID NOT NULL,
    "rule_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reassignment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID,
    "lead_id" UUID,
    "contact_id" UUID,
    "template_id" UUID,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "payload" JSONB,
    "provider_message_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_webhooks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_opt_outs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "reason" TEXT,
    "opted_out_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_key" TEXT NOT NULL,
    "schedule" JSONB,
    "channel" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders_sent" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT,

    CONSTRAINT "reminders_sent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "rule" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_ledger" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "entry_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_approvals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ledger_id" UUID NOT NULL,
    "approved_by" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklist_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "identifier_type" TEXT NOT NULL,
    "identifier_value" TEXT NOT NULL,
    "reason" TEXT,
    "severity" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklist_matches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "match_score" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'flagged',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklist_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_scores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "factors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_scores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "reasons" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_metrics_daily" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "metric_date" DATE NOT NULL,
    "team_id" UUID,
    "user_id" UUID,
    "leads_created" INTEGER NOT NULL DEFAULT 0,
    "leads_closed" INTEGER NOT NULL DEFAULT 0,
    "avg_cycle_hours" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discipline_index_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "factors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discipline_index_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "ranking_type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipients" JSONB,
    "template_ref" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rule_id" UUID,
    "event_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_key" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "tenants_created_at_idx" ON "tenants"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_email_idx" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "users_tenant_id_status_idx" ON "users"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_profiles_tenant_id_user_id_idx" ON "user_profiles"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "teams_tenant_id_leader_user_id_idx" ON "teams"("tenant_id", "leader_user_id");

-- CreateIndex
CREATE INDEX "teams_tenant_id_status_idx" ON "teams"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "team_members_tenant_id_team_id_idx" ON "team_members"("tenant_id", "team_id");

-- CreateIndex
CREATE INDEX "team_members_tenant_id_user_id_idx" ON "team_members"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "roles_tenant_id_name_idx" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "roles_parent_role_id_idx" ON "roles"("parent_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_key_idx" ON "permissions"("module_key");

-- CreateIndex
CREATE INDEX "role_permissions_tenant_id_role_id_idx" ON "role_permissions"("tenant_id", "role_id");

-- CreateIndex
CREATE INDEX "role_permissions_tenant_id_permission_id_idx" ON "role_permissions"("tenant_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_roles_tenant_id_user_id_idx" ON "user_roles"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "user_roles_tenant_id_role_id_idx" ON "user_roles"("tenant_id", "role_id");

-- CreateIndex
CREATE INDEX "user_permissions_tenant_id_user_id_idx" ON "user_permissions"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "user_permissions_tenant_id_permission_id_idx" ON "user_permissions"("tenant_id", "permission_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_actor_user_id_idx" ON "audit_logs"("tenant_id", "actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "modules_key_key" ON "modules"("key");

-- CreateIndex
CREATE INDEX "modules_status_idx" ON "modules"("status");

-- CreateIndex
CREATE INDEX "module_configs_tenant_id_module_id_idx" ON "module_configs"("tenant_id", "module_id");

-- CreateIndex
CREATE INDEX "module_configs_tenant_id_is_active_idx" ON "module_configs"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "module_permissions_module_id_idx" ON "module_permissions"("module_id");

-- CreateIndex
CREATE INDEX "module_permissions_permission_id_idx" ON "module_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "module_event_subscriptions_tenant_id_module_id_idx" ON "module_event_subscriptions"("tenant_id", "module_id");

-- CreateIndex
CREATE INDEX "module_event_subscriptions_event_key_idx" ON "module_event_subscriptions"("event_key");

-- CreateIndex
CREATE INDEX "module_event_subscriptions_tenant_id_is_active_idx" ON "module_event_subscriptions"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "files_tenant_id_created_by_idx" ON "files"("tenant_id", "created_by");

-- CreateIndex
CREATE INDEX "files_tenant_id_created_at_idx" ON "files"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "notes_tenant_id_entity_type_entity_id_idx" ON "notes"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notes_tenant_id_created_by_idx" ON "notes"("tenant_id", "created_by");

-- CreateIndex
CREATE INDEX "lead_sources_tenant_id_name_idx" ON "lead_sources"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_primary_email_idx" ON "contacts"("tenant_id", "primary_email");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_primary_phone_idx" ON "contacts"("tenant_id", "primary_phone");

-- CreateIndex
CREATE INDEX "contact_channels_tenant_id_contact_id_idx" ON "contact_channels"("tenant_id", "contact_id");

-- CreateIndex
CREATE INDEX "contact_channels_tenant_id_channel_type_idx" ON "contact_channels"("tenant_id", "channel_type");

-- CreateIndex
CREATE INDEX "leads_tenant_id_lead_code_idx" ON "leads"("tenant_id", "lead_code");

-- CreateIndex
CREATE INDEX "leads_tenant_id_status_idx" ON "leads"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "leads_tenant_id_assigned_user_id_idx" ON "leads"("tenant_id", "assigned_user_id");

-- CreateIndex
CREATE INDEX "leads_tenant_id_created_at_idx" ON "leads"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_contacts_tenant_id_lead_id_idx" ON "lead_contacts"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_contacts_tenant_id_contact_id_idx" ON "lead_contacts"("tenant_id", "contact_id");

-- CreateIndex
CREATE INDEX "lead_tags_tenant_id_name_idx" ON "lead_tags"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "lead_tag_links_tenant_id_lead_id_idx" ON "lead_tag_links"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_tag_links_tenant_id_tag_id_idx" ON "lead_tag_links"("tenant_id", "tag_id");

-- CreateIndex
CREATE INDEX "lead_assignments_tenant_id_lead_id_idx" ON "lead_assignments"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_assignments_tenant_id_assigned_user_id_idx" ON "lead_assignments"("tenant_id", "assigned_user_id");

-- CreateIndex
CREATE INDEX "lead_assignments_assigned_at_idx" ON "lead_assignments"("assigned_at");

-- CreateIndex
CREATE INDEX "lead_activity_logs_tenant_id_lead_id_idx" ON "lead_activity_logs"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_activity_logs_tenant_id_actor_user_id_idx" ON "lead_activity_logs"("tenant_id", "actor_user_id");

-- CreateIndex
CREATE INDEX "lead_activity_logs_created_at_idx" ON "lead_activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "lead_tasks_tenant_id_lead_id_idx" ON "lead_tasks"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_tasks_tenant_id_assigned_user_id_idx" ON "lead_tasks"("tenant_id", "assigned_user_id");

-- CreateIndex
CREATE INDEX "lead_tasks_tenant_id_due_at_idx" ON "lead_tasks"("tenant_id", "due_at");

-- CreateIndex
CREATE INDEX "lead_tasks_tenant_id_status_idx" ON "lead_tasks"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "call_logs_tenant_id_lead_id_idx" ON "call_logs"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "call_logs_tenant_id_caller_user_id_idx" ON "call_logs"("tenant_id", "caller_user_id");

-- CreateIndex
CREATE INDEX "call_logs_call_time_idx" ON "call_logs"("call_time");

-- CreateIndex
CREATE INDEX "lead_state_definitions_tenant_id_code_idx" ON "lead_state_definitions"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "lead_state_transitions_tenant_id_from_state_id_idx" ON "lead_state_transitions"("tenant_id", "from_state_id");

-- CreateIndex
CREATE INDEX "lead_state_transitions_tenant_id_to_state_id_idx" ON "lead_state_transitions"("tenant_id", "to_state_id");

-- CreateIndex
CREATE INDEX "lead_state_history_tenant_id_lead_id_idx" ON "lead_state_history"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_state_history_tenant_id_changed_at_idx" ON "lead_state_history"("tenant_id", "changed_at");

-- CreateIndex
CREATE INDEX "lead_deadlines_tenant_id_lead_id_idx" ON "lead_deadlines"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_deadlines_tenant_id_due_at_idx" ON "lead_deadlines"("tenant_id", "due_at");

-- CreateIndex
CREATE INDEX "lead_deadlines_tenant_id_status_idx" ON "lead_deadlines"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "lead_extensions_tenant_id_lead_id_idx" ON "lead_extensions"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_extensions_tenant_id_status_idx" ON "lead_extensions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "lead_extensions_tenant_id_requested_at_idx" ON "lead_extensions"("tenant_id", "requested_at");

-- CreateIndex
CREATE INDEX "lead_failures_tenant_id_lead_id_idx" ON "lead_failures"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_failures_tenant_id_status_idx" ON "lead_failures"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "lead_failures_tenant_id_created_at_idx" ON "lead_failures"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_closures_tenant_id_lead_id_idx" ON "lead_closures"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_closures_tenant_id_closed_at_idx" ON "lead_closures"("tenant_id", "closed_at");

-- CreateIndex
CREATE INDEX "user_requests_tenant_id_status_idx" ON "user_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "user_requests_tenant_id_created_at_idx" ON "user_requests"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "finance_entries_tenant_id_entry_type_idx" ON "finance_entries"("tenant_id", "entry_type");

-- CreateIndex
CREATE INDEX "finance_entries_tenant_id_occurred_at_idx" ON "finance_entries"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "properties_tenant_id_city_idx" ON "properties"("tenant_id", "city");

-- CreateIndex
CREATE INDEX "properties_tenant_id_property_type_idx" ON "properties"("tenant_id", "property_type");

-- CreateIndex
CREATE INDEX "properties_tenant_id_status_idx" ON "properties"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "property_units_tenant_id_property_id_idx" ON "property_units"("tenant_id", "property_id");

-- CreateIndex
CREATE INDEX "property_units_tenant_id_unit_code_idx" ON "property_units"("tenant_id", "unit_code");

-- CreateIndex
CREATE INDEX "listings_tenant_id_property_id_idx" ON "listings"("tenant_id", "property_id");

-- CreateIndex
CREATE INDEX "listings_tenant_id_status_idx" ON "listings"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "listings_tenant_id_price_idx" ON "listings"("tenant_id", "price");

-- CreateIndex
CREATE INDEX "listing_media_tenant_id_listing_id_idx" ON "listing_media"("tenant_id", "listing_id");

-- CreateIndex
CREATE INDEX "listing_media_tenant_id_sort_order_idx" ON "listing_media"("tenant_id", "sort_order");

-- CreateIndex
CREATE INDEX "inquiries_tenant_id_lead_id_idx" ON "inquiries"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "inquiries_tenant_id_listing_id_idx" ON "inquiries"("tenant_id", "listing_id");

-- CreateIndex
CREATE INDEX "deals_tenant_id_lead_id_idx" ON "deals"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "deals_tenant_id_status_idx" ON "deals"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "deals_tenant_id_closed_at_idx" ON "deals"("tenant_id", "closed_at");

-- CreateIndex
CREATE INDEX "offers_tenant_id_deal_id_idx" ON "offers"("tenant_id", "deal_id");

-- CreateIndex
CREATE INDEX "offers_tenant_id_status_idx" ON "offers"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "meetings_tenant_id_lead_id_idx" ON "meetings"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "meetings_tenant_id_starts_at_idx" ON "meetings"("tenant_id", "starts_at");

-- CreateIndex
CREATE INDEX "meetings_tenant_id_organizer_user_id_idx" ON "meetings"("tenant_id", "organizer_user_id");

-- CreateIndex
CREATE INDEX "meeting_participants_tenant_id_meeting_id_idx" ON "meeting_participants"("tenant_id", "meeting_id");

-- CreateIndex
CREATE INDEX "meeting_participants_tenant_id_participant_type_idx" ON "meeting_participants"("tenant_id", "participant_type");

-- CreateIndex
CREATE INDEX "meeting_rooms_tenant_id_status_idx" ON "meeting_rooms"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "meeting_reschedule_requests_tenant_id_meeting_id_idx" ON "meeting_reschedule_requests"("tenant_id", "meeting_id");

-- CreateIndex
CREATE INDEX "meeting_reschedule_requests_tenant_id_status_idx" ON "meeting_reschedule_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "meeting_reminders_tenant_id_scheduled_at_idx" ON "meeting_reminders"("tenant_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "meeting_reminders_tenant_id_status_idx" ON "meeting_reminders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "reassignment_rules_tenant_id_trigger_key_idx" ON "reassignment_rules"("tenant_id", "trigger_key");

-- CreateIndex
CREATE INDEX "reassignment_rules_tenant_id_is_active_idx" ON "reassignment_rules"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "reassignment_pools_tenant_id_name_idx" ON "reassignment_pools"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "pool_members_tenant_id_pool_id_idx" ON "pool_members"("tenant_id", "pool_id");

-- CreateIndex
CREATE INDEX "pool_members_tenant_id_user_id_idx" ON "pool_members"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "negligence_points_tenant_id_user_id_idx" ON "negligence_points"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "negligence_points_tenant_id_lead_id_idx" ON "negligence_points"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "reassignment_events_tenant_id_lead_id_idx" ON "reassignment_events"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "reassignment_events_tenant_id_from_user_id_idx" ON "reassignment_events"("tenant_id", "from_user_id");

-- CreateIndex
CREATE INDEX "reassignment_events_tenant_id_to_user_id_idx" ON "reassignment_events"("tenant_id", "to_user_id");

-- CreateIndex
CREATE INDEX "whatsapp_accounts_tenant_id_phone_number_idx" ON "whatsapp_accounts"("tenant_id", "phone_number");

-- CreateIndex
CREATE INDEX "whatsapp_accounts_tenant_id_status_idx" ON "whatsapp_accounts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "whatsapp_templates_tenant_id_name_idx" ON "whatsapp_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "whatsapp_templates_tenant_id_status_idx" ON "whatsapp_templates"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "whatsapp_messages_tenant_id_lead_id_idx" ON "whatsapp_messages"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "whatsapp_messages_tenant_id_status_idx" ON "whatsapp_messages"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "whatsapp_messages_tenant_id_sent_at_idx" ON "whatsapp_messages"("tenant_id", "sent_at");

-- CreateIndex
CREATE INDEX "whatsapp_webhooks_tenant_id_event_type_idx" ON "whatsapp_webhooks"("tenant_id", "event_type");

-- CreateIndex
CREATE INDEX "whatsapp_webhooks_received_at_idx" ON "whatsapp_webhooks"("received_at");

-- CreateIndex
CREATE INDEX "whatsapp_opt_outs_tenant_id_contact_id_idx" ON "whatsapp_opt_outs"("tenant_id", "contact_id");

-- CreateIndex
CREATE INDEX "reminder_rules_tenant_id_trigger_key_idx" ON "reminder_rules"("tenant_id", "trigger_key");

-- CreateIndex
CREATE INDEX "reminder_rules_tenant_id_is_active_idx" ON "reminder_rules"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "reminder_schedules_tenant_id_scheduled_at_idx" ON "reminder_schedules"("tenant_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "reminder_schedules_tenant_id_status_idx" ON "reminder_schedules"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "reminders_sent_tenant_id_lead_id_idx" ON "reminders_sent"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "reminders_sent_tenant_id_sent_at_idx" ON "reminders_sent"("tenant_id", "sent_at");

-- CreateIndex
CREATE INDEX "commission_plans_tenant_id_is_active_idx" ON "commission_plans"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "commission_rules_tenant_id_plan_id_idx" ON "commission_rules"("tenant_id", "plan_id");

-- CreateIndex
CREATE INDEX "commission_ledger_tenant_id_deal_id_idx" ON "commission_ledger"("tenant_id", "deal_id");

-- CreateIndex
CREATE INDEX "commission_ledger_tenant_id_user_id_idx" ON "commission_ledger"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "commission_ledger_tenant_id_status_idx" ON "commission_ledger"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "commission_approvals_tenant_id_ledger_id_idx" ON "commission_approvals"("tenant_id", "ledger_id");

-- CreateIndex
CREATE INDEX "commission_approvals_tenant_id_status_idx" ON "commission_approvals"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "blacklist_entries_tenant_id_identifier_type_identifier_valu_idx" ON "blacklist_entries"("tenant_id", "identifier_type", "identifier_value");

-- CreateIndex
CREATE INDEX "blacklist_entries_tenant_id_severity_idx" ON "blacklist_entries"("tenant_id", "severity");

-- CreateIndex
CREATE INDEX "blacklist_matches_tenant_id_lead_id_idx" ON "blacklist_matches"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "blacklist_matches_tenant_id_status_idx" ON "blacklist_matches"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "risk_scores_tenant_id_lead_id_idx" ON "risk_scores"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "risk_scores_tenant_id_score_idx" ON "risk_scores"("tenant_id", "score");

-- CreateIndex
CREATE INDEX "lead_scores_tenant_id_lead_id_idx" ON "lead_scores"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "lead_scores_tenant_id_score_idx" ON "lead_scores"("tenant_id", "score");

-- CreateIndex
CREATE INDEX "lead_metrics_daily_tenant_id_metric_date_idx" ON "lead_metrics_daily"("tenant_id", "metric_date");

-- CreateIndex
CREATE INDEX "lead_metrics_daily_tenant_id_team_id_idx" ON "lead_metrics_daily"("tenant_id", "team_id");

-- CreateIndex
CREATE INDEX "lead_metrics_daily_tenant_id_user_id_idx" ON "lead_metrics_daily"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "discipline_index_snapshots_tenant_id_snapshot_date_idx" ON "discipline_index_snapshots"("tenant_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "discipline_index_snapshots_tenant_id_user_id_idx" ON "discipline_index_snapshots"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "ranking_snapshots_tenant_id_snapshot_date_idx" ON "ranking_snapshots"("tenant_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "ranking_snapshots_tenant_id_ranking_type_idx" ON "ranking_snapshots"("tenant_id", "ranking_type");

-- CreateIndex
CREATE INDEX "notification_events_tenant_id_event_key_idx" ON "notification_events"("tenant_id", "event_key");

-- CreateIndex
CREATE INDEX "notification_events_created_at_idx" ON "notification_events"("created_at");

-- CreateIndex
CREATE INDEX "notification_rules_tenant_id_event_key_idx" ON "notification_rules"("tenant_id", "event_key");

-- CreateIndex
CREATE INDEX "notification_rules_tenant_id_is_active_idx" ON "notification_rules"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "notification_deliveries_tenant_id_status_idx" ON "notification_deliveries"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "notification_deliveries_tenant_id_scheduled_at_idx" ON "notification_deliveries"("tenant_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "scheduled_jobs_tenant_id_job_key_idx" ON "scheduled_jobs"("tenant_id", "job_key");

-- CreateIndex
CREATE INDEX "scheduled_jobs_tenant_id_is_active_idx" ON "scheduled_jobs"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "job_runs_tenant_id_job_id_idx" ON "job_runs"("tenant_id", "job_id");

-- CreateIndex
CREATE INDEX "job_runs_tenant_id_status_idx" ON "job_runs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "job_runs_started_at_idx" ON "job_runs"("started_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_avatar_file_id_fkey" FOREIGN KEY ("avatar_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_parent_role_id_fkey" FOREIGN KEY ("parent_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_configs" ADD CONSTRAINT "module_configs_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_configs" ADD CONSTRAINT "module_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_permissions" ADD CONSTRAINT "module_permissions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_permissions" ADD CONSTRAINT "module_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_event_subscriptions" ADD CONSTRAINT "module_event_subscriptions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_event_subscriptions" ADD CONSTRAINT "module_event_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_channels" ADD CONSTRAINT "contact_channels_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_channels" ADD CONSTRAINT "contact_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_contacts" ADD CONSTRAINT "lead_contacts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_contacts" ADD CONSTRAINT "lead_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_contacts" ADD CONSTRAINT "lead_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tag_links" ADD CONSTRAINT "lead_tag_links_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tag_links" ADD CONSTRAINT "lead_tag_links_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "lead_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tag_links" ADD CONSTRAINT "lead_tag_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activity_logs" ADD CONSTRAINT "lead_activity_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activity_logs" ADD CONSTRAINT "lead_activity_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activity_logs" ADD CONSTRAINT "lead_activity_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_caller_user_id_fkey" FOREIGN KEY ("caller_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_recording_file_id_fkey" FOREIGN KEY ("recording_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_state_definitions" ADD CONSTRAINT "lead_state_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_state_transitions" ADD CONSTRAINT "lead_state_transitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_state_transitions" ADD CONSTRAINT "lead_state_transitions_from_state_id_fkey" FOREIGN KEY ("from_state_id") REFERENCES "lead_state_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_state_transitions" ADD CONSTRAINT "lead_state_transitions_to_state_id_fkey" FOREIGN KEY ("to_state_id") REFERENCES "lead_state_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_state_history" ADD CONSTRAINT "lead_state_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_state_history" ADD CONSTRAINT "lead_state_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_state_history" ADD CONSTRAINT "lead_state_history_from_state_id_fkey" FOREIGN KEY ("from_state_id") REFERENCES "lead_state_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_state_history" ADD CONSTRAINT "lead_state_history_to_state_id_fkey" FOREIGN KEY ("to_state_id") REFERENCES "lead_state_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_state_history" ADD CONSTRAINT "lead_state_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_deadlines" ADD CONSTRAINT "lead_deadlines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_deadlines" ADD CONSTRAINT "lead_deadlines_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_deadlines" ADD CONSTRAINT "lead_deadlines_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "lead_state_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_extensions" ADD CONSTRAINT "lead_extensions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_extensions" ADD CONSTRAINT "lead_extensions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_extensions" ADD CONSTRAINT "lead_extensions_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "lead_state_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_extensions" ADD CONSTRAINT "lead_extensions_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_extensions" ADD CONSTRAINT "lead_extensions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_failures" ADD CONSTRAINT "lead_failures_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_failures" ADD CONSTRAINT "lead_failures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_failures" ADD CONSTRAINT "lead_failures_failed_by_fkey" FOREIGN KEY ("failed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_closures" ADD CONSTRAINT "lead_closures_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_closures" ADD CONSTRAINT "lead_closures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_closures" ADD CONSTRAINT "lead_closures_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_requests" ADD CONSTRAINT "user_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_requests" ADD CONSTRAINT "user_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_requests" ADD CONSTRAINT "user_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_contact_id_fkey" FOREIGN KEY ("owner_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_units" ADD CONSTRAINT "property_units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_units" ADD CONSTRAINT "property_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "property_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organizer_user_id_fkey" FOREIGN KEY ("organizer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_rooms" ADD CONSTRAINT "meeting_rooms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reschedule_requests" ADD CONSTRAINT "meeting_reschedule_requests_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reschedule_requests" ADD CONSTRAINT "meeting_reschedule_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reschedule_requests" ADD CONSTRAINT "meeting_reschedule_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reminders" ADD CONSTRAINT "meeting_reminders_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reminders" ADD CONSTRAINT "meeting_reminders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_rules" ADD CONSTRAINT "reassignment_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_pools" ADD CONSTRAINT "reassignment_pools_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "reassignment_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negligence_points" ADD CONSTRAINT "negligence_points_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negligence_points" ADD CONSTRAINT "negligence_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negligence_points" ADD CONSTRAINT "negligence_points_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_events" ADD CONSTRAINT "reassignment_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_events" ADD CONSTRAINT "reassignment_events_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_events" ADD CONSTRAINT "reassignment_events_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_events" ADD CONSTRAINT "reassignment_events_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "reassignment_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reassignment_events" ADD CONSTRAINT "reassignment_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "whatsapp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_webhooks" ADD CONSTRAINT "whatsapp_webhooks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_opt_outs" ADD CONSTRAINT "whatsapp_opt_outs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_opt_outs" ADD CONSTRAINT "whatsapp_opt_outs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "reminder_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders_sent" ADD CONSTRAINT "reminders_sent_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "reminder_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders_sent" ADD CONSTRAINT "reminders_sent_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders_sent" ADD CONSTRAINT "reminders_sent_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "commission_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_approvals" ADD CONSTRAINT "commission_approvals_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "commission_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_approvals" ADD CONSTRAINT "commission_approvals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_approvals" ADD CONSTRAINT "commission_approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_entries" ADD CONSTRAINT "blacklist_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_matches" ADD CONSTRAINT "blacklist_matches_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_matches" ADD CONSTRAINT "blacklist_matches_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "blacklist_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_matches" ADD CONSTRAINT "blacklist_matches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_metrics_daily" ADD CONSTRAINT "lead_metrics_daily_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_metrics_daily" ADD CONSTRAINT "lead_metrics_daily_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_metrics_daily" ADD CONSTRAINT "lead_metrics_daily_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discipline_index_snapshots" ADD CONSTRAINT "discipline_index_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discipline_index_snapshots" ADD CONSTRAINT "discipline_index_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "notification_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "notification_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "scheduled_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
