import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Core Manus-authenticated users. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const tournaments = mysqlTable("tournaments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  normalizedName: varchar("normalizedName", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = typeof tournaments.$inferInsert;

export const fixtures = mysqlTable(
  "fixtures",
  {
    id: int("id").autoincrement().primaryKey(),
    externalId: varchar("externalId", { length: 128 }).notNull().unique(),
    tournamentId: int("tournamentId").notNull(),
    teamOne: varchar("teamOne", { length: 160 }).notNull(),
    teamTwo: varchar("teamTwo", { length: 160 }).notNull(),
    venue: varchar("venue", { length: 255 }),
    startTimeUtc: timestamp("startTimeUtc").notNull(),
    localDateGmt6: varchar("localDateGmt6", { length: 10 }).notNull(),
    localTimeGmt6: varchar("localTimeGmt6", { length: 5 }).notNull(),
    status: mysqlEnum("status", ["scheduled", "live", "completed", "postponed", "cancelled"]).default("scheduled").notNull(),
    scoreSummary: text("scoreSummary"),
    matchUrl: text("matchUrl"),
    bloggerPostId: varchar("bloggerPostId", { length: 128 }),
    bloggerPostUrl: text("bloggerPostUrl"),
    firstPublishedAt: timestamp("firstPublishedAt"),
    lastPublishedAt: timestamp("lastPublishedAt"),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
);

export type Fixture = typeof fixtures.$inferSelect;
export type InsertFixture = typeof fixtures.$inferInsert;

export const publisherSettings = mysqlTable("publisher_settings", {
  id: int("id").autoincrement().primaryKey(),
  blogId: varchar("blogId", { length: 128 }).notNull().unique(),
  blogUrl: text("blogUrl").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  googleRefreshToken: text("googleRefreshToken"),
  oauthState: varchar("oauthState", { length: 128 }),
  lastRunAt: timestamp("lastRunAt"),
  lastRunStatus: mysqlEnum("lastRunStatus", ["success", "partial", "failed"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PublisherSettings = typeof publisherSettings.$inferSelect;
export type InsertPublisherSettings = typeof publisherSettings.$inferInsert;

export const publisherRuns = mysqlTable("publisher_runs", {
  id: int("id").autoincrement().primaryKey(),
  trigger: mysqlEnum("trigger", ["scheduled", "manual"]).notNull(),
  status: mysqlEnum("status", ["running", "success", "partial", "failed"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
  fixturesFetched: int("fixturesFetched").default(0).notNull(),
  postsCreated: int("postsCreated").default(0).notNull(),
  postsUpdated: int("postsUpdated").default(0).notNull(),
  apiStatusCode: int("apiStatusCode"),
  bloggerStatusCode: int("bloggerStatusCode"),
  postUrls: text("postUrls"),
  errorMessage: text("errorMessage"),
});

export type PublisherRun = typeof publisherRuns.$inferSelect;
export type InsertPublisherRun = typeof publisherRuns.$inferInsert;
