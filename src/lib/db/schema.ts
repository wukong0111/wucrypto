import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("groups_user_slug_idx").on(table.userId, table.slug)],
);

export const coins = pgTable(
  "coins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    coinId: varchar("coin_id", { length: 100 }).notNull(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
  },
  (table) => [uniqueIndex("coins_group_coinid_idx").on(table.groupId, table.coinId)],
);

export const movements = pgTable(
  "movements",
  {
    id: uuid("id").primaryKey(),
    coinId: uuid("coin_id")
      .notNull()
      .references(() => coins.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 4 }).notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    amount: doublePrecision("amount").notNull(),
    pricePerCoin: doublePrecision("price_per_coin").notNull(),
    note: text("note").notNull().default(""),
  },
  (table) => [index("movements_coin_idx").on(table.coinId)],
);
