import { integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const fixtureStatusEnum = pgEnum("fixture_status", ["scheduled", "live", "completed", "postponed", "cancelled"]);
export const runTriggerEnum = pgEnum("run_trigger", ["scheduled", "manual"]);
export const runStatusEnum = pgEnum("run_status", ["running", "success", "partial", "failed"]);

export const users = pgTable("users", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const tournaments = pgTable("tournaments", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  normalizedName: varchar("normalizedName", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = typeof tournaments.$inferInsert;

export const fixtures = pgTable("fixtures", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  externalId: varchar("externalId", { length: 128 }).notNull().unique(),
  tournamentId: integer("tournamentId").notNull(),
  teamOne: varchar("teamOne", { length: 160 }).notNull(),
  teamTwo: varchar("teamTwo", { length: 160 }).notNull(),
  venue: varchar("venue", { length: 255 }),
  startTimeUtc: timestamp("startTimeUtc", { withTimezone: true }).notNull(),
  localDateGmt6: varchar("localDateGmt6", { length: 10 }).notNull(),
  localTimeGmt6: varchar("localTimeGmt6", { length: 5 }).notNull(),
  status: fixtureStatusEnum("status").default("scheduled").notNull(),
  scoreSummary: text("scoreSummary"),
  matchUrl: text("matchUrl"),
  bloggerPostId: varchar("bloggerPostId", { length: 128 }),
  bloggerPostUrl: text("bloggerPostUrl"),
  firstPublishedAt: timestamp("firstPublishedAt", { withTimezone: true }),
  lastPublishedAt: timestamp("lastPublishedAt", { withTimezone: true }),
  lastSyncedAt: timestamp("lastSyncedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type Fixture = typeof fixtures.$inferSelect;
export type InsertFixture = typeof fixtures.$inferInsert;

export const publisherSettings = pgTable("publisher_settings", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  blogId: varchar("blogId", { length: 128 }).notNull().unique(),
  blogUrl: text("blogUrl").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  googleRefreshToken: text("googleRefreshToken"),
  oauthState: varchar("oauthState", { length: 128 }),
  lastRunAt: timestamp("lastRunAt", { withTimezone: true }),
  lastRunStatus: runStatusEnum("lastRunStatus"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type PublisherSettings = typeof publisherSettings.$inferSelect;
export type InsertPublisherSettings = typeof publisherSettings.$inferInsert;

export const publisherRuns = pgTable("publisher_runs", {
  id: integer("id").generatedByDefaultAsIdentity().primaryKey(),
  trigger: runTriggerEnum("trigger").notNull(),
  status: runStatusEnum("status").notNull(),
  startedAt: timestamp("startedAt", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finishedAt", { withTimezone: true }),
  fixturesFetched: integer("fixturesFetched").default(0).notNull(),
  postsCreated: integer("postsCreated").default(0).notNull(),
  postsUpdated: integer("postsUpdated").default(0).notNull(),
  apiStatusCode: integer("apiStatusCode"),
  bloggerStatusCode: integer("bloggerStatusCode"),
  postUrls: text("postUrls"),
  errorMessage: text("errorMessage"),
});
export type PublisherRun = typeof publisherRuns.$inferSelect;
export type InsertPublisherRun = typeof publisherRuns.$inferInsert;
