#!/usr/bin/env bun
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url =
  Bun.env["DATABASE_URL"] ?? "postgres://wucrypto:wucrypto@localhost:5432/wucrypto";

const client = postgres(url, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder: "./drizzle" });

await client.end();
process.exit(0);
