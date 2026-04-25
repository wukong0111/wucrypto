import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = Bun.env["DATABASE_URL"] ?? "postgres://wucrypto:wucrypto@localhost:5432/wucrypto";
const client = postgres(url);
export const db = drizzle(client, { schema });
