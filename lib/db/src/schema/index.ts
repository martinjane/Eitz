import {
  pgTable,
  text,
  timestamp,
  serial,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:            serial("id").primaryKey(),
  eitaaId:       text("eitaa_id").notNull().unique(),
  username:      text("username").notNull().unique(),
  firstName:     text("first_name"),
  lastName:      text("last_name"),
  deviceId:      text("device_id"),
  tosAcceptedAt: timestamp("tos_accepted_at"),   // set on first registration; null for pre-ToS accounts
  registrationMessageSent: boolean("registration_message_sent").default(false).notNull(),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});
export type User       = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Logos ────────────────────────────────────────────────────────────────────
export const logos = pgTable("logos", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  data:      text("data").notNull(),
  mimeType:  text("mime_type").notNull(),
  size:      integer("size").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Logo       = typeof logos.$inferSelect;
export type InsertLogo = typeof logos.$inferInsert;

// ── Saved Styles ─────────────────────────────────────────────────────────────
export const savedStyles = pgTable("saved_styles", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  data:      jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SavedStyle       = typeof savedStyles.$inferSelect;
export type InsertSavedStyle = typeof savedStyles.$inferInsert;

// ── Payments ─────────────────────────────────────────────────────────────────
export const payments = pgTable("payments", {
  id:                  serial("id").primaryKey(),
  orderId:             text("order_id").notNull().unique(),
  idpayId:             text("idpay_id"),
  trackId:             text("track_id"),
  type:                text("type").notNull(),              // "donation" | "ad"
  refId:               integer("ref_id"),                  // advertisements.id for "ad"
  /** The authenticated user who initiated this payment (null for anonymous donations). */
  userId:              integer("user_id").references(() => users.id, { onDelete: "set null" }),
  amountRials:         integer("amount_rials").notNull(),
  status:              text("status").notNull().default("pending"),
  /** Payment gateway redirect link stored for "resume payment" support. */
  paymentUrl:          text("payment_url"),
  /** When the gateway link expires (typically 30 min after creation). */
  paymentUrlExpiresAt: timestamp("payment_url_expires_at"),
  verifiedAt:          timestamp("verified_at"),
  verificationPayload: jsonb("verification_payload"),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
});
export type Payment       = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ── Saved Ads (content templates: created in Settings, reviewed before scheduling) ──
export const savedAds = pgTable("saved_ads", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channelLink: text("channel_link").notNull(),
  channelName: text("channel_name").notNull(),
  adText:      text("ad_text").notNull(),
  adImage:     text("ad_image").notNull(),
  // draft | content_approved | content_rejected
  status:      text("status").notNull().default("draft"),
  reviewNote:  text("review_note"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});
export type SavedAd       = typeof savedAds.$inferSelect;
export type InsertSavedAd = typeof savedAds.$inferInsert;

// ── Advertisements ────────────────────────────────────────────────────────────
export const advertisements = pgTable("advertisements", {
  id:                serial("id").primaryKey(),
  savedAdId:         integer("saved_ad_id").references(() => savedAds.id, { onDelete: "set null" }),
  channelLink:       text("channel_link").notNull(),
  channelName:       text("channel_name").notNull(),
  adText:            text("ad_text").notNull(),
  adImage:           text("ad_image").notNull(),
  submitterIp:       text("submitter_ip"),
  status:            text("status").notNull().default("pending_payment"),
  ownershipVerified: boolean("ownership_verified").default(false),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
  updatedAt:         timestamp("updated_at").defaultNow().notNull(),
});
export type Advertisement       = typeof advertisements.$inferSelect;
export type InsertAdvertisement = typeof advertisements.$inferInsert;

// ── Ad Windows ────────────────────────────────────────────────────────────────
export const adWindows = pgTable("ad_windows", {
  id:            serial("id").primaryKey(),
  adId:          integer("ad_id").notNull().references(() => advertisements.id, { onDelete: "cascade" }),
  windowDate:    text("window_date").notNull(),
  windowSlot:    integer("window_slot").notNull(),
  status:        text("status").notNull().default("reserved"),
  reservedUntil: timestamp("reserved_until"),
  reserverIp:    text("reserver_ip"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});
export type AdWindow       = typeof adWindows.$inferSelect;
export type InsertAdWindow = typeof adWindows.$inferInsert;

// ── Channel Verifications ─────────────────────────────────────────────────────
export const channelVerifications = pgTable("channel_verifications", {
  id:               serial("id").primaryKey(),
  userId:           integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channelUsername:  text("channel_username").notNull(),
  channelLink:      text("channel_link").notNull(),
  verificationCode: text("verification_code").notNull(),
  status:           text("status").notNull().default("pending"),
  reviewNote:       text("review_note"),
  submittedAt:      timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt:       timestamp("reviewed_at"),
});
export type ChannelVerification       = typeof channelVerifications.$inferSelect;
export type InsertChannelVerification = typeof channelVerifications.$inferInsert;

// ── Pricing Config ────────────────────────────────────────────────────────────
export const pricingConfig = pgTable("pricing_config", {
  key:       text("key").primaryKey(),
  value:     jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type PricingConfig       = typeof pricingConfig.$inferSelect;
export type InsertPricingConfig = typeof pricingConfig.$inferInsert;

// ── User Ad Terms Acceptance ──────────────────────────────────────────────────
export const userAdTermsAcceptance = pgTable("user_ad_terms_acceptance", {
  id:         serial("id").primaryKey(),
  userId:     integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
});
export type UserAdTermsAcceptance       = typeof userAdTermsAcceptance.$inferSelect;
export type InsertUserAdTermsAcceptance = typeof userAdTermsAcceptance.$inferInsert;

// ── Feedback ───────────────────────────────────────────────────────────────────
export const feedbackReports = pgTable("feedback_reports", {
  id:        serial("id").primaryKey(),
  message:   text("message").notNull(),
  username:  text("username").notNull().default("unknown"),
  /** Permanent user ID — used for rate-limit cooldown so username changes don't bypass it. */
  userId:    integer("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FeedbackReport = typeof feedbackReports.$inferSelect;
export type InsertFeedbackReport = typeof feedbackReports.$inferInsert;
