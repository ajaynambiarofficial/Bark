import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull().default(""),
  clearanceLevel: integer("clearance_level").notNull().default(10),
  builtIn: boolean("built_in").notNull().default(false),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  description: text("description").notNull(),
  module: varchar("module", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]);

export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  address: text("address").notNull().default(""),
  timezone: varchar("timezone", { length: 80 }).notNull().default("Asia/Calcutta"),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 254 }),
  operatingHours: jsonb("operating_hours").$type<Record<string, unknown>>().notNull().default({}),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeCode: varchar("employee_code", { length: 80 }).notNull().unique(),
  email: varchar("email", { length: 254 }).notNull(),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 40 }),
  profileBio: varchar("profile_bio", { length: 500 }),
  avatarData: text("avatar_data"),
  passwordHash: text("password_hash").notNull(),
  roleId: uuid("role_id").notNull().references(() => roles.id),
  department: varchar("department", { length: 120 }).notNull(),
  assignment: varchar("assignment", { length: 160 }).notNull(),
  accountStatus: varchar("account_status", { length: 30 }).notNull().default("active"),
  clearanceLevel: integer("clearance_level").notNull().default(10),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`), index("users_role_idx").on(table.roleId), index("users_status_idx").on(table.accountStatus)]);

export const agentGoals = pgTable("agent_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description").notNull().default(""),
  targetValue: numeric("target_value", { precision: 14, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 40 }).notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  ...timestamps,
}, (table) => [index("agent_goals_user_active_idx").on(table.userId, table.active), index("agent_goals_period_idx").on(table.startsOn, table.endsOn)]);

export const userPermissions = pgTable("user_permissions", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  granted: boolean("granted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.permissionId] })]);

export const userClinics = pgTable("user_clinics", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  accessLevel: varchar("access_level", { length: 30 }).notNull().default("read"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.clinicId] })]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedReason: text("revoked_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("sessions_user_idx").on(table.userId), index("sessions_expiry_idx").on(table.expiresAt)]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 254 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  ipAddress: varchar("ip_address", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("password_reset_email_ip_created_idx").on(table.email, table.ipAddress, table.createdAt), index("password_reset_user_idx").on(table.userId)]);

export const authenticationAttempts = pgTable("authentication_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 254 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }).notNull(),
  succeeded: boolean("succeeded").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("auth_attempt_lookup_idx").on(table.email, table.ipAddress, table.attemptedAt)]);

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: varchar("sku", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const clinicServices = pgTable("clinic_services", {
  clinicId: uuid("clinic_id").notNull().references(() => clinics.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  price: numeric("price", { precision: 12, scale: 2 }),
  durationMinutes: integer("duration_minutes"),
  active: boolean("active").notNull().default(true),
}, (table) => [primaryKey({ columns: [table.clinicId, table.serviceId] })]);

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description").notNull().default(""),
  discountType: varchar("discount_type", { length: 16 }).notNull(),
  discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull(),
  minimumSubtotal: numeric("minimum_subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  clinicId: uuid("clinic_id").references(() => clinics.id, { onDelete: "set null" }),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  ...timestamps,
}, (table) => [uniqueIndex("offers_code_lower_unique").on(sql`lower(${table.code})`), index("offers_active_clinic_idx").on(table.active, table.clinicId)]);

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalRef: varchar("external_ref", { length: 100 }),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  email: varchar("email", { length: 254 }),
  petName: varchar("pet_name", { length: 120 }),
  petSpecies: varchar("pet_species", { length: 80 }),
  notes: text("notes").notNull().default(""),
  ...timestamps,
}, (table) => [index("customers_phone_idx").on(table.phone), index("customers_external_ref_idx").on(table.externalRef)]);

export const customerPets = pgTable("customer_pets", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  species: varchar("species", { length: 80 }).notNull(),
  breed: varchar("breed", { length: 120 }),
  size: varchar("size", { length: 30 }),
  coatType: varchar("coat_type", { length: 30 }),
  sex: varchar("sex", { length: 20 }),
  reproductiveStatus: varchar("reproductive_status", { length: 30 }),
  birthDate: timestamp("birth_date", { withTimezone: true }),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  ...timestamps,
}, (table) => [index("customer_pets_customer_idx").on(table.customerId)]);

export const customerHealthRecords = pgTable("customer_health_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  petId: uuid("pet_id").notNull().references(() => customerPets.id, { onDelete: "cascade" }),
  recordType: varchar("record_type", { length: 60 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  status: varchar("status", { length: 40 }).notNull().default("active"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
  ...timestamps,
}, (table) => [index("customer_health_pet_idx").on(table.petId, table.recordedAt)]);

export const customerOrders = pgTable("customer_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  orderNumber: varchar("order_number", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull().defaultNow(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 40 }).notNull().default("placed"),
  ...timestamps,
}, (table) => [index("customer_orders_customer_idx").on(table.customerId, table.orderedAt)]);

export const customerPackages = pgTable("customer_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  packageName: varchar("package_name", { length: 180 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  totalUses: integer("total_uses").notNull(),
  remainingUses: integer("remaining_uses").notNull(),
  activeFrom: timestamp("active_from", { withTimezone: true }).notNull().defaultNow(),
  activeUntil: timestamp("active_until", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("customer_packages_customer_status_idx").on(table.customerId, table.status)]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: varchar("reference", { length: 40 }).notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  clinicId: uuid("clinic_id").notNull().references(() => clinics.id),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  petId: uuid("pet_id").references(() => customerPets.id),
  assignedStaffId: uuid("assigned_staff_id").references(() => users.id),
  status: varchar("status", { length: 40 }).notNull().default("confirmed"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  source: varchar("source", { length: 60 }).notNull().default("bark"),
  notes: text("notes").notNull().default(""),
  cancellationReason: text("cancellation_reason"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("bookings_clinic_time_idx").on(table.clinicId, table.startsAt), index("bookings_staff_time_idx").on(table.assignedStaffId, table.startsAt), index("bookings_status_idx").on(table.status)]);

export const bookingHistory = pgTable("booking_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  action: varchar("action", { length: 60 }).notNull(),
  previousValue: jsonb("previous_value").$type<Record<string, unknown>>(),
  newValue: jsonb("new_value").$type<Record<string, unknown>>(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("booking_history_booking_idx").on(table.bookingId, table.createdAt)]);

export const slaPolicies = pgTable("sla_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  issueType: varchar("issue_type", { length: 40 }).notNull(),
  category: varchar("category", { length: 80 }),
  priority: varchar("priority", { length: 20 }).notNull(),
  targetMinutes: integer("target_minutes").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const notices = pgTable("notices", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  type: varchar("type", { length: 24 }).notNull().default("general"),
  cadence: varchar("cadence", { length: 16 }).notNull().default("once"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: uuid("archived_by").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps,
}, (table) => [index("notices_active_expiry_idx").on(table.archivedAt, table.expiresAt), index("notices_created_idx").on(table.createdAt)]);

export const noticeComments = pgTable("notice_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  noticeId: uuid("notice_id").notNull().references(() => notices.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("notice_comments_notice_created_idx").on(table.noticeId, table.createdAt)]);

export const noticeAcknowledgements = pgTable("notice_acknowledgements", {
  noticeId: uuid("notice_id").notNull().references(() => notices.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.noticeId, table.userId] }), index("notice_acknowledgements_user_idx").on(table.userId)]);

export const teamEmails = pgTable("team_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  subject: varchar("subject", { length: 200 }).notNull().default(""),
  body: text("body").notNull().default(""),
  recipientUserIds: jsonb("recipient_user_ids").$type<string[]>().notNull().default([]),
  status: varchar("status", { length: 16 }).$type<"draft" | "sending" | "sent" | "failed">().notNull().default("draft"),
  providerMessageId: varchar("provider_message_id", { length: 500 }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("team_emails_author_updated_idx").on(table.createdBy, table.updatedAt)]);

export const teamEmailMailbox = pgTable("team_email_mailbox", {
  id: varchar("id", { length: 32 }).primaryKey().default("shared"),
  connectedEmail: varchar("connected_email", { length: 254 }),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  oauthStateHash: varchar("oauth_state_hash", { length: 64 }),
  oauthStateExpiresAt: timestamp("oauth_state_expires_at", { withTimezone: true }),
  updatedBy: uuid("updated_by").references(() => users.id),
  ...timestamps,
});

export const assignmentRules = pgTable("assignment_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  clinicId: uuid("clinic_id").references(() => clinics.id),
  ownerId: uuid("owner_id").references(() => users.id),
  team: varchar("team", { length: 120 }),
  priority: integer("priority").notNull().default(100),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const escalations = pgTable("escalations", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: varchar("reference", { length: 40 }).notNull().unique(),
  issueType: varchar("issue_type", { length: 40 }).notNull(),
  referenceType: varchar("reference_type", { length: 40 }).notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  module: varchar("module", { length: 100 }),
  channel: varchar("channel", { length: 100 }),
  service: varchar("service", { length: 160 }),
  issueSubtype: varchar("issue_subtype", { length: 180 }).notNull(),
  customIssue: text("custom_issue"),
  linkedTicketId: varchar("linked_ticket_id", { length: 80 }),
  customerPhone: varchar("customer_phone", { length: 30 }),
  customerPhoneMasked: varchar("customer_phone_masked", { length: 30 }),
  appointmentId: varchar("appointment_id", { length: 80 }),
  attachmentMetadata: jsonb("attachment_metadata").$type<Array<{ id: string; name: string; size: number; type: string }>>().notNull().default([]),
  clinicId: uuid("clinic_id").references(() => clinics.id),
  reporterId: uuid("reporter_id").notNull().references(() => users.id),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  originatingDepartment: varchar("originating_department", { length: 120 }).notNull(),
  responsibleDepartment: varchar("responsible_department", { length: 120 }).notNull(),
  assignedTeam: varchar("assigned_team", { length: 120 }).notNull(),
  tier: integer("tier").notNull().default(1),
  priority: varchar("priority", { length: 20 }).notNull(),
  status: varchar("status", { length: 40 }).notNull().default("Assigned"),
  slaPolicyId: uuid("sla_policy_id").references(() => slaPolicies.id),
  slaDueAt: timestamp("sla_due_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("escalations_owner_status_idx").on(table.ownerId, table.status), index("escalations_clinic_idx").on(table.clinicId), index("escalations_sla_idx").on(table.slaDueAt)]);

export const escalationComments = pgTable("escalation_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  escalationId: uuid("escalation_id").notNull().references(() => escalations.id),
  authorId: uuid("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  visibility: varchar("visibility", { length: 30 }).notNull().default("internal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("escalation_comments_idx").on(table.escalationId, table.createdAt)]);

export const escalationActivity = pgTable("escalation_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  escalationId: uuid("escalation_id").notNull().references(() => escalations.id),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  action: varchar("action", { length: 80 }).notNull(),
  previousValue: jsonb("previous_value").$type<Record<string, unknown>>(),
  newValue: jsonb("new_value").$type<Record<string, unknown>>(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("escalation_activity_idx").on(table.escalationId, table.createdAt)]);

export const escalationOwnershipHistory = pgTable("escalation_ownership_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  escalationId: uuid("escalation_id").notNull().references(() => escalations.id),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  assignedBy: uuid("assigned_by").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("escalation_ownership_idx").on(table.escalationId, table.assignedAt)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  channel: varchar("channel", { length: 30 }).notNull(),
  templateKey: varchar("template_key", { length: 80 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("notifications_delivery_idx").on(table.status, table.nextAttemptAt)]);

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 160 }).notNull(),
  eventType: varchar("event_type", { length: 60 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  description: text("description").notNull().default(""),
  clinicId: uuid("clinic_id").references(() => clinics.id),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("calendar_start_idx").on(table.startsAt), index("calendar_clinic_idx").on(table.clinicId)]);

export const applicationSettings = pgTable("application_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  description: text("description").notNull().default(""),
  secret: boolean("secret").notNull().default(false),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const featureFlags = pgTable("feature_flags", {
  key: varchar("key", { length: 120 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description").notNull().default(""),
  rules: jsonb("rules").$type<Record<string, unknown>>().notNull().default({}),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationTemplates = pgTable("notification_templates", {
  key: varchar("key", { length: 120 }).primaryKey(),
  channel: varchar("channel", { length: 30 }).notNull(),
  subject: varchar("subject", { length: 240 }),
  body: text("body").notNull(),
  active: boolean("active").notNull().default(true),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id),
  actorRole: varchar("actor_role", { length: 64 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }).notNull(),
  previousValue: jsonb("previous_value").$type<Record<string, unknown>>(),
  newValue: jsonb("new_value").$type<Record<string, unknown>>(),
  reason: text("reason"),
  requestId: uuid("request_id"),
  ipAddress: varchar("ip_address", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("audit_entity_idx").on(table.entityType, table.entityId, table.createdAt), index("audit_actor_idx").on(table.actorId, table.createdAt), index("audit_action_idx").on(table.action, table.createdAt)]);

export type UserRecord = typeof users.$inferSelect;
export type SessionRecord = typeof sessions.$inferSelect;
export type BookingRecord = typeof bookings.$inferSelect;
export type EscalationRecord = typeof escalations.$inferSelect;
