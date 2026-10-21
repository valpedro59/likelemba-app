import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  index,
  unique,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

/* -------------------------------------------------------------------------- */
/*  Enums                                                                     */
/* -------------------------------------------------------------------------- */

export const frequencyEnum = pgEnum("frequency", [
  "weekly",
  "biweekly",
  "monthly",
]);
export const providerEnum = pgEnum("provider", ["MTN", "AIRTEL"]);

export const groupStatusEnum = pgEnum("group_status", [
  "draft", // en cours de constitution, ordre pas encore validé
  "active",
  "completed",
  "cancelled",
]);
export const memberRoleEnum = pgEnum("member_role", ["admin", "member"]);
export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "left",
  "removed",
]);

export const cycleStatusEnum = pgEnum("cycle_status", [
  "upcoming",
  "collecting", // cotisations ouvertes
  "collected", // cagnotte complète, payout à lancer
  "paid_out",
]);
// "En retard" n'est PAS stocké : pending + due_date dépassée
export const contributionStatusEnum = pgEnum("contribution_status", [
  "pending",
  "paid",
  "waived",
]);

export const txTypeEnum = pgEnum("tx_type", ["contribution", "payout"]);
export const txStatusEnum = pgEnum("tx_status", [
  "pending",
  "processing",
  "successful",
  "failed",
]);

export const reminderKindEnum = pgEnum("reminder_kind", [
  "due_j7",
  "due_j1",
  "overdue",
]);
export const reminderChannelEnum = pgEnum("reminder_channel", [
  "sms",
  "whatsapp",
  "push",
]);
export const reminderStatusEnum = pgEnum("reminder_status", ["sent", "failed"]);

/* -------------------------------------------------------------------------- */
/*  1. Utilisateurs                                                           */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull().unique(), // E.164 : +242XXXXXXXXX
  momoProvider: providerEnum("momo_provider").notNull(),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/*  2. Groupes                                                                */
/* -------------------------------------------------------------------------- */

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Montants en entiers : le XAF n'a pas de centimes
    amountPerCycle: integer("amount_per_cycle").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("XAF"),
    frequency: frequencyEnum("frequency").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    maxMembers: integer("max_members"),
    status: groupStatusEnum("status").notNull().default("draft"),
    ...timestamps,
  },
  (t) => [
    check("groups_amount_positive", sql`${t.amountPerCycle} > 0`),
    index("groups_creator_idx").on(t.creatorId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  3. Invitations (lien unique partageable)                                  */
/* -------------------------------------------------------------------------- */

export const groupInvites = pgTable(
  "group_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull().unique(), // token aléatoire dans le lien
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usesCount: integer("uses_count").notNull().default(0),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("group_invites_group_idx").on(t.groupId)],
);

/* -------------------------------------------------------------------------- */
/*  4. Membres du groupe & ordre de passage                                   */
/* -------------------------------------------------------------------------- */

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: memberRoleEnum("role").notNull().default("member"),
    status: memberStatusEnum("status").notNull().default("active"),
    // null tant que l'admin n'a pas validé l'ordre
    payoutOrder: integer("payout_order"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("group_members_group_user_uq").on(t.groupId, t.userId),
    // Attention : pour réordonner (swap), renumérotez dans une transaction
    // avec des valeurs temporaires, sinon la contrainte bloque.
    unique("group_members_group_order_uq").on(t.groupId, t.payoutOrder),
    index("group_members_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  5. Cycles / échéances                                                     */
/* -------------------------------------------------------------------------- */

export const cycles = pgTable(
  "cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    cycleNumber: integer("cycle_number").notNull(), // 1, 2, 3...
    beneficiaryMemberId: uuid("beneficiary_member_id")
      .notNull()
      .references(() => groupMembers.id, { onDelete: "restrict" }),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: cycleStatusEnum("status").notNull().default("upcoming"),
    payoutCompletedAt: timestamp("payout_completed_at", {
      withTimezone: true,
    }),
    ...timestamps,
  },
  (t) => [
    unique("cycles_group_number_uq").on(t.groupId, t.cycleNumber),
    // Sert à la requête quotidienne des rappels J-7
    index("cycles_due_status_idx").on(t.dueDate, t.status),
  ],
);

/* -------------------------------------------------------------------------- */
/*  6. Cotisations attendues (une ligne par membre et par cycle)              */
/*     → permet d'afficher Payé / En attente / En retard                      */
/* -------------------------------------------------------------------------- */

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => groupMembers.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    status: contributionStatusEnum("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("contributions_cycle_member_uq").on(t.cycleId, t.memberId),
    index("contributions_status_idx").on(t.status),
  ],
);

/* -------------------------------------------------------------------------- */
/*  7. Transactions Mobile Money (Pawapay)                                    */
/*     id = depositId / payoutId envoyé à Pawapay (idempotence)               */
/* -------------------------------------------------------------------------- */

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: txTypeEnum("type").notNull(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => cycles.id, { onDelete: "restrict" }),
    contributionId: uuid("contribution_id").references(() => contributions.id, {
      onDelete: "restrict",
    }),
    // payeur si contribution, bénéficiaire si payout
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("XAF"),
    provider: providerEnum("provider").notNull(),
    phone: varchar("phone", { length: 20 }).notNull(), // numéro utilisé au moment du paiement
    status: txStatusEnum("status").notNull().default("pending"),
    providerReference: varchar("provider_reference", { length: 255 }),
    failureCode: varchar("failure_code", { length: 100 }),
    rawCallback: jsonb("raw_callback"), // dernier webhook reçu, pour l'audit
    ...timestamps,
  },
  (t) => [
    check("tx_amount_positive", sql`${t.amount} > 0`),
    check(
      "tx_contribution_requires_link",
      sql`${t.type} = 'payout' OR ${t.contributionId} IS NOT NULL`,
    ),
    // Un seul payout actif par cycle : empêche de payer deux fois le bénéficiaire
    uniqueIndex("tx_one_active_payout_per_cycle")
      .on(t.cycleId)
      .where(sql`${t.type} = 'payout' AND ${t.status} <> 'failed'`),
    // Une seule tentative de paiement active par cotisation : empêche le double prélèvement
    uniqueIndex("tx_one_active_deposit_per_contribution")
      .on(t.contributionId)
      .where(sql`${t.type} = 'contribution' AND ${t.status} <> 'failed'`),
    index("tx_cycle_idx").on(t.cycleId),
    index("tx_user_idx").on(t.userId),
    index("tx_provider_ref_idx").on(t.providerReference),
  ],
);

/* -------------------------------------------------------------------------- */
/*  8. Rappels envoyés (idempotence du cron)                                  */
/* -------------------------------------------------------------------------- */

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, { onDelete: "cascade" }),
    kind: reminderKindEnum("kind").notNull(),
    channel: reminderChannelEnum("channel").notNull(),
    status: reminderStatusEnum("status").notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Le cron peut tourner deux fois sans renvoyer le même message
    unique("reminders_once_uq").on(t.contributionId, t.kind, t.channel),
  ],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    fullName: varchar("full_name", { length: 255 }),
    momoProvider: providerEnum("momo_provider"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("otp_codes_phone_idx").on(t.phone)],
);
