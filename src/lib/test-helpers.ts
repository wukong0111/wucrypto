import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema";

export async function truncateAll() {
  const { db } = await import("./db");
  await db.delete(schema.movements);
  await db.delete(schema.coins);
  await db.delete(schema.groups);
  await db.delete(schema.sessions);
  await db.delete(schema.users);
}

export async function createTestUser() {
  const { db } = await import("./db");
  const hash = await Bun.password.hash("testpass123", { algorithm: "bcrypt" });
  const [user] = await db
    .insert(schema.users)
    .values({ username: "testuser", passwordHash: hash })
    .returning();
  if (!user) throw new Error("Failed to create test user");
  return user;
}
