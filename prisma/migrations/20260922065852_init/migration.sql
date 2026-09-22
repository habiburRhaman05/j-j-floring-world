-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT_SET', 'ESTIMATE_SENT', 'FOLLOW_UP', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('FACEBOOK_ADS', 'GOOGLE_ADS', 'WEBSITE_FORM', 'ORGANIC_SEARCH', 'REFERRAL', 'WALK_IN', 'INBOUND_CALL', 'REPEAT_CUSTOMER', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadLostReason" AS ENUM ('PRICE', 'TIMELINE', 'WENT_ELSEWHERE', 'NO_RESPONSE', 'NOT_QUALIFIED', 'DUPLICATE', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "AssignmentStrategy" AS ENUM ('CSR_MANUAL', 'ADMIN_OVERRIDE', 'AUTO_ROUND_ROBIN', 'AUTO_TERRITORY', 'AUTO_LOAD_BALANCED', 'AUTO_SOURCE_RULE', 'SLA_FALLBACK');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL_OUTBOUND', 'CALL_INBOUND', 'SMS', 'EMAIL', 'SITE_VISIT', 'NOTE', 'STAGE_CHANGE', 'ASSIGNMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivityOutcome" AS ENUM ('ANSWERED', 'VOICEMAIL', 'NO_ANSWER', 'WRONG_NUMBER', 'NOT_INTERESTED', 'CALLBACK_REQUESTED', 'COMPLETED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('MEASURE', 'CONSULTATION', 'FOLLOW_UP', 'INSTALL_WALKTHROUGH', 'WARRANTY_VISIT');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'SHOWED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('SF', 'SY', 'LF', 'EA', 'HR', 'GAL', 'BOX');

-- CreateEnum
CREATE TYPE "TierLevel" AS ENUM ('GOOD', 'BETTER', 'BEST');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'EXPIRED', 'SUPERSEDED', 'VOID');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('NOT_CREATED', 'DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'VOIDED');

-- CreateEnum
CREATE TYPE "JobStage" AS ENUM ('DEPOSIT_PAID', 'MATERIALS_ORDERED', 'READY_TO_SCHEDULE', 'SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobPhotoType" AS ENUM ('BEFORE', 'PROGRESS', 'COMPLETION', 'ISSUE', 'MATERIAL_DELIVERY');

-- CreateEnum
CREATE TYPE "JobIssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKING');

-- CreateEnum
CREATE TYPE "JobIssueStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'WONT_FIX');

-- CreateEnum
CREATE TYPE "MaterialOrderStatus" AS ENUM ('NOT_ORDERED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'BACKORDERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'ACH', 'CASH', 'CHECK', 'FINANCING', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('CONTRACT_REVENUE', 'GROSS_MARGIN');

-- CreateEnum
CREATE TYPE "CommissionRuleType" AS ENUM ('FLAT_PERCENT', 'TIERED_BY_MARGIN', 'FLAT_AMOUNT');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('ACCRUED', 'EARNED', 'APPROVED', 'PAID', 'CLAWED_BACK', 'VOID');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SyncOwner" AS ENUM ('APP', 'GHL');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('PUSH', 'PULL', 'BIDIRECTIONAL', 'NONE');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'IN_FLIGHT', 'SUCCEEDED', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "SyncEntity" AS ENUM ('LEAD', 'APPOINTMENT', 'ESTIMATE_DOCUMENT', 'INVOICE', 'PAYMENT', 'OPPORTUNITY', 'USER', 'NOTE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarFileId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "totpSecret" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "backupCodes" JSONB,
    "maxOpenLeads" INTEGER,
    "workingHours" JSONB,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "ghlUserId" TEXT,
    "ghlCalendarId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "defaultScope" TEXT NOT NULL DEFAULT 'own',
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT,
    "description" TEXT NOT NULL,
    "isFieldLevel" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "constraints" JSONB,
    "reason" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "activeRoleId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crews" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leadId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_members" (
    "id" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crew_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "syncSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "ghlContactId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "ghlTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
    "sourceDetail" TEXT,
    "assignedRepId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "qualifiedAt" TIMESTAMP(3),
    "lostReason" "LeadLostReason",
    "lostNote" TEXT,
    "estimatedValue" DECIMAL(14,2),
    "scopeSummary" TEXT,
    "slaStartedAt" TIMESTAMP(3),
    "slaBreachedAt" TIMESTAMP(3),
    "ghlOpportunityId" TEXT,
    "ghlPipelineId" TEXT,
    "ghlStageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT,
    "strategy" "AssignmentStrategy" NOT NULL,
    "reason" TEXT,
    "strategyContext" JSONB,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "strategy" "AssignmentStrategy" NOT NULL,
    "criteria" JSONB NOT NULL,
    "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "territories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postalCodes" TEXT[],
    "userIds" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "ghlNoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "ActivityType" NOT NULL,
    "outcome" "ActivityOutcome",
    "subject" TEXT,
    "body" TEXT,
    "durationSec" INTEGER,
    "ghlMessageId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "ghlAppointmentId" TEXT,
    "ghlCalendarId" TEXT,
    "type" "AppointmentType" NOT NULL DEFAULT 'MEASURE',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "location" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "bookedById" TEXT,
    "selfBooked" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "rescheduledFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "leadTimeDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "supplierId" TEXT,
    "unit" "UnitOfMeasure" NOT NULL,
    "costPerUnit" DECIMAL(14,4) NOT NULL,
    "pricePerUnit" DECIMAL(14,4) NOT NULL,
    "tierAffinity" "TierLevel",
    "wasteFactor" DECIMAL(5,4),
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price_history" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "actorId" TEXT,
    "oldCost" DECIMAL(14,4) NOT NULL,
    "newCost" DECIMAL(14,4) NOT NULL,
    "oldPrice" DECIMAL(14,4) NOT NULL,
    "newPrice" DECIMAL(14,4) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "repId" TEXT NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersededById" TEXT,
    "acceptedTier" "TierLevel",
    "depositPercent" DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "ghlDocumentId" TEXT,
    "documentStatus" "DocumentStatus" NOT NULL DEFAULT 'NOT_CREATED',
    "documentUrl" TEXT,
    "documentSentAt" TIMESTAMP(3),
    "documentViewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedByName" TEXT,
    "signedByEmail" TEXT,
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_tiers" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "level" "TierLevel" NOT NULL,
    "label" TEXT,
    "summary" TEXT,
    "discountPercent" DECIMAL(5,2),
    "discountAmount" DECIMAL(14,2),
    "discountReason" TEXT,
    "discountApprovedById" TEXT,
    "subtotalPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "estimate_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_line_items" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" "UnitOfMeasure" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_events" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "soldTier" "TierLevel" NOT NULL,
    "stage" "JobStage" NOT NULL DEFAULT 'DEPOSIT_PAID',
    "installerId" TEXT,
    "crewId" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "arrivalWindowStart" TIMESTAMP(3),
    "arrivalWindowEnd" TIMESTAMP(3),
    "estimatedDurationHours" DECIMAL(6,2),
    "siteAddressLine1" TEXT,
    "siteCity" TEXT,
    "siteState" TEXT,
    "sitePostalCode" TEXT,
    "accessNotes" TEXT,
    "specialInstructions" TEXT,
    "materialsReceived" BOOLEAN NOT NULL DEFAULT false,
    "materialsReceivedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "adminConfirmedAt" TIMESTAMP(3),
    "adminConfirmedById" TEXT,
    "completionSignoffName" TEXT,
    "completionSignoffAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_stage_history" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStage" "JobStage",
    "toStage" "JobStage" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "wasQueued" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_photos" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" "JobPhotoType" NOT NULL,
    "caption" TEXT,
    "uploadedById" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_issues" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "severity" "JobIssueSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "JobIssueStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_checklist_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_checklist_items" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "note" TEXT,

    CONSTRAINT "job_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_orders" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "supplierName" TEXT,
    "status" "MaterialOrderStatus" NOT NULL DEFAULT 'NOT_ORDERED',
    "poNumber" TEXT,
    "orderedAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL,
    "quantityOrdered" DECIMAL(14,4) NOT NULL,
    "quantityReceived" DECIMAL(14,4) NOT NULL DEFAULT 0,

    CONSTRAINT "material_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "jobId" TEXT,
    "estimateId" TEXT,
    "ghlInvoiceId" TEXT,
    "ghlInvoiceUrl" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountDue" DECIMAL(14,2) NOT NULL,
    "snapshotCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "depositPercent" DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    "depositAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isDeposit" BOOLEAN NOT NULL DEFAULT false,
    "isChangeOrder" BOOLEAN NOT NULL DEFAULT false,
    "parentInvoiceId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "ghlTransactionId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "note" TEXT,
    "isOffline" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT,
    "refundedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "refundedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "roleId" TEXT,
    "type" "CommissionRuleType" NOT NULL DEFAULT 'FLAT_PERCENT',
    "basis" "CommissionBasis" NOT NULL DEFAULT 'CONTRACT_REVENUE',
    "ratePercent" DECIMAL(6,4),
    "flatAmount" DECIMAL(14,2),
    "tiers" JSONB,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "ruleId" TEXT,
    "basis" "CommissionBasis" NOT NULL,
    "basisAmount" DECIMAL(14,2) NOT NULL,
    "ratePercent" DECIMAL(6,4),
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'ACCRUED',
    "accruedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "earnedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "clawedBackAt" TIMESTAMP(3),
    "clawbackReason" TEXT,
    "payoutLineId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_lines" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "payout_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branding_profiles" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "legalName" TEXT,
    "logoFileId" TEXT,
    "faviconFileId" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#6B4526',
    "accentColor" TEXT NOT NULL DEFAULT '#B4813F',
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "websiteUrl" TEXT,
    "addressBlock" TEXT,
    "documentHeaderHtml" TEXT,
    "emailFooterHtml" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branding_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "encryptionKeyId" TEXT NOT NULL,
    "locationId" TEXT,
    "companyId" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastVerifyError" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ghl_pipeline_mappings" (
    "id" TEXT NOT NULL,
    "ghlPipelineId" TEXT NOT NULL,
    "ghlStageId" TEXT NOT NULL,
    "ghlStageName" TEXT NOT NULL,
    "localStage" "LeadStage" NOT NULL,
    "direction" "SyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ghl_pipeline_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ghl_field_mappings" (
    "id" TEXT NOT NULL,
    "entity" "SyncEntity" NOT NULL,
    "ghlFieldId" TEXT NOT NULL,
    "ghlFieldKey" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "direction" "SyncDirection" NOT NULL DEFAULT 'PULL',
    "transform" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ghl_field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_field_policies" (
    "id" TEXT NOT NULL,
    "entity" "SyncEntity" NOT NULL,
    "field" TEXT NOT NULL,
    "owner" "SyncOwner" NOT NULL,
    "direction" "SyncDirection" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_field_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_states" (
    "id" TEXT NOT NULL,
    "entity" "SyncEntity" NOT NULL,
    "localId" TEXT NOT NULL,
    "ghlId" TEXT,
    "lastPushedAt" TIMESTAMP(3),
    "lastPulledAt" TIMESTAMP(3),
    "lastPushHash" TEXT,
    "remoteVersion" TEXT,
    "localVersion" INTEGER NOT NULL DEFAULT 0,
    "inConflict" BOOLEAN NOT NULL DEFAULT false,
    "conflictNote" TEXT,
    "lastError" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_outbox" (
    "id" TEXT NOT NULL,
    "entity" "SyncEntity" NOT NULL,
    "localId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "partitionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gohighlevel',
    "externalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" TEXT NOT NULL,
    "entity" "SyncEntity" NOT NULL,
    "localId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "localValue" JSONB,
    "remoteValue" JSONB,
    "resolvedAs" "SyncOwner" NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "thumbnailKey" TEXT,
    "checksum" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkUrl" TEXT,
    "entity" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_ghlUserId_key" ON "users"("ghlUserId");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_resource_action_idx" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "permissions_category_idx" ON "permissions"("category");

-- CreateIndex
CREATE INDEX "role_permissions_roleId_idx" ON "role_permissions"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "user_roles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "user_permission_overrides_userId_expiresAt_idx" ON "user_permission_overrides"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_userId_permissionId_effect_key" ON "user_permission_overrides"("userId", "permissionId", "effect");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_tokenHash_key" ON "user_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "user_invitations_email_idx" ON "user_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "crew_members_crewId_userId_key" ON "crew_members"("crewId", "userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "leads_ghlContactId_key" ON "leads"("ghlContactId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_ghlOpportunityId_key" ON "leads"("ghlOpportunityId");

-- CreateIndex
CREATE INDEX "leads_stage_idx" ON "leads"("stage");

-- CreateIndex
CREATE INDEX "leads_assignedRepId_stage_idx" ON "leads"("assignedRepId", "stage");

-- CreateIndex
CREATE INDEX "leads_postalCode_idx" ON "leads"("postalCode");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- CreateIndex
CREATE INDEX "leads_slaStartedAt_idx" ON "leads"("slaStartedAt");

-- CreateIndex
CREATE INDEX "lead_assignments_leadId_assignedAt_idx" ON "lead_assignments"("leadId", "assignedAt");

-- CreateIndex
CREATE INDEX "lead_assignments_assignedToId_idx" ON "lead_assignments"("assignedToId");

-- CreateIndex
CREATE INDEX "assignment_rules_active_priority_idx" ON "assignment_rules"("active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "lead_notes_ghlNoteId_key" ON "lead_notes"("ghlNoteId");

-- CreateIndex
CREATE INDEX "lead_notes_leadId_createdAt_idx" ON "lead_notes"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "lead_activities_ghlMessageId_key" ON "lead_activities"("ghlMessageId");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_occurredAt_idx" ON "lead_activities"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "lead_activities_type_idx" ON "lead_activities"("type");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_ghlAppointmentId_key" ON "appointments"("ghlAppointmentId");

-- CreateIndex
CREATE INDEX "appointments_ownerId_startAt_idx" ON "appointments"("ownerId", "startAt");

-- CreateIndex
CREATE INDEX "appointments_leadId_idx" ON "appointments"("leadId");

-- CreateIndex
CREATE INDEX "appointments_startAt_idx" ON "appointments"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_key_key" ON "product_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_categoryId_active_idx" ON "products"("categoryId", "active");

-- CreateIndex
CREATE INDEX "products_active_idx" ON "products"("active");

-- CreateIndex
CREATE INDEX "product_price_history_productId_createdAt_idx" ON "product_price_history"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_number_key" ON "estimates"("number");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_supersededById_key" ON "estimates"("supersededById");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_ghlDocumentId_key" ON "estimates"("ghlDocumentId");

-- CreateIndex
CREATE INDEX "estimates_leadId_idx" ON "estimates"("leadId");

-- CreateIndex
CREATE INDEX "estimates_repId_status_idx" ON "estimates"("repId", "status");

-- CreateIndex
CREATE INDEX "estimates_status_idx" ON "estimates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_tiers_estimateId_level_key" ON "estimate_tiers"("estimateId", "level");

-- CreateIndex
CREATE INDEX "estimate_line_items_tierId_idx" ON "estimate_line_items"("tierId");

-- CreateIndex
CREATE INDEX "estimate_events_estimateId_occurredAt_idx" ON "estimate_events"("estimateId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_number_key" ON "jobs"("number");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_estimateId_key" ON "jobs"("estimateId");

-- CreateIndex
CREATE INDEX "jobs_stage_idx" ON "jobs"("stage");

-- CreateIndex
CREATE INDEX "jobs_installerId_scheduledDate_idx" ON "jobs"("installerId", "scheduledDate");

-- CreateIndex
CREATE INDEX "jobs_crewId_scheduledDate_idx" ON "jobs"("crewId", "scheduledDate");

-- CreateIndex
CREATE INDEX "jobs_scheduledDate_idx" ON "jobs"("scheduledDate");

-- CreateIndex
CREATE INDEX "job_stage_history_jobId_occurredAt_idx" ON "job_stage_history"("jobId", "occurredAt");

-- CreateIndex
CREATE INDEX "job_photos_jobId_type_idx" ON "job_photos"("jobId", "type");

-- CreateIndex
CREATE INDEX "job_issues_jobId_status_idx" ON "job_issues"("jobId", "status");

-- CreateIndex
CREATE INDEX "job_issues_status_severity_idx" ON "job_issues"("status", "severity");

-- CreateIndex
CREATE INDEX "job_checklist_items_jobId_idx" ON "job_checklist_items"("jobId");

-- CreateIndex
CREATE INDEX "material_orders_jobId_idx" ON "material_orders"("jobId");

-- CreateIndex
CREATE INDEX "material_orders_status_idx" ON "material_orders"("status");

-- CreateIndex
CREATE INDEX "material_order_lines_orderId_idx" ON "material_order_lines"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_ghlInvoiceId_key" ON "invoices"("ghlInvoiceId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_jobId_idx" ON "invoices"("jobId");

-- CreateIndex
CREATE INDEX "invoices_leadId_idx" ON "invoices"("leadId");

-- CreateIndex
CREATE INDEX "invoices_dueAt_idx" ON "invoices"("dueAt");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_ghlTransactionId_key" ON "payments"("ghlTransactionId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "commission_rules_userId_effectiveFrom_idx" ON "commission_rules"("userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "commission_rules_roleId_effectiveFrom_idx" ON "commission_rules"("roleId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "commission_ledger_userId_status_idx" ON "commission_ledger"("userId", "status");

-- CreateIndex
CREATE INDEX "commission_ledger_jobId_idx" ON "commission_ledger"("jobId");

-- CreateIndex
CREATE INDEX "commission_ledger_status_idx" ON "commission_ledger"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_number_key" ON "payouts"("number");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payout_lines_payoutId_userId_key" ON "payout_lines"("payoutId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "app_settings_category_idx" ON "app_settings"("category");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_provider_key" ON "integration_credentials"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ghl_pipeline_mappings_ghlPipelineId_ghlStageId_key" ON "ghl_pipeline_mappings"("ghlPipelineId", "ghlStageId");

-- CreateIndex
CREATE UNIQUE INDEX "ghl_field_mappings_entity_ghlFieldId_key" ON "ghl_field_mappings"("entity", "ghlFieldId");

-- CreateIndex
CREATE INDEX "sync_field_policies_entity_idx" ON "sync_field_policies"("entity");

-- CreateIndex
CREATE UNIQUE INDEX "sync_field_policies_entity_field_key" ON "sync_field_policies"("entity", "field");

-- CreateIndex
CREATE INDEX "sync_states_entity_ghlId_idx" ON "sync_states"("entity", "ghlId");

-- CreateIndex
CREATE INDEX "sync_states_inConflict_idx" ON "sync_states"("inConflict");

-- CreateIndex
CREATE UNIQUE INDEX "sync_states_entity_localId_key" ON "sync_states"("entity", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "sync_outbox_idempotencyKey_key" ON "sync_outbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "sync_outbox_status_nextAttemptAt_idx" ON "sync_outbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "sync_outbox_partitionKey_createdAt_idx" ON "sync_outbox"("partitionKey", "createdAt");

-- CreateIndex
CREATE INDEX "sync_outbox_entity_localId_idx" ON "sync_outbox"("entity", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_externalId_key" ON "webhook_events"("externalId");

-- CreateIndex
CREATE INDEX "webhook_events_status_receivedAt_idx" ON "webhook_events"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "webhook_events_eventType_idx" ON "webhook_events"("eventType");

-- CreateIndex
CREATE INDEX "sync_conflicts_entity_localId_idx" ON "sync_conflicts"("entity", "localId");

-- CreateIndex
CREATE INDEX "sync_conflicts_resolvedAt_idx" ON "sync_conflicts"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_storageKey_key" ON "file_assets"("storageKey");

-- CreateIndex
CREATE INDEX "file_assets_uploadedById_idx" ON "file_assets"("uploadedById");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_type_channel_key" ON "notification_preferences"("userId", "type", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_tasks_key_key" ON "scheduled_tasks"("key");

-- CreateIndex
CREATE INDEX "scheduled_tasks_runAt_executedAt_idx" ON "scheduled_tasks"("runAt", "executedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crews" ADD CONSTRAINT "crews_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedRepId_fkey" FOREIGN KEY ("assignedRepId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_repId_fkey" FOREIGN KEY ("repId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_tiers" ADD CONSTRAINT "estimate_tiers_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "estimate_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_events" ADD CONSTRAINT "estimate_events_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_installerId_fkey" FOREIGN KEY ("installerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "crews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_stage_history" ADD CONSTRAINT "job_stage_history_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_stage_history" ADD CONSTRAINT "job_stage_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_issues" ADD CONSTRAINT "job_issues_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_issues" ADD CONSTRAINT "job_issues_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_issues" ADD CONSTRAINT "job_issues_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_checklist_items" ADD CONSTRAINT "job_checklist_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_orders" ADD CONSTRAINT "material_orders_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_order_lines" ADD CONSTRAINT "material_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "material_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_order_lines" ADD CONSTRAINT "material_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "commission_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_payoutLineId_fkey" FOREIGN KEY ("payoutLineId") REFERENCES "payout_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_lines" ADD CONSTRAINT "payout_lines_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_lines" ADD CONSTRAINT "payout_lines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branding_profiles" ADD CONSTRAINT "branding_profiles_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branding_profiles" ADD CONSTRAINT "branding_profiles_faviconFileId_fkey" FOREIGN KEY ("faviconFileId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
