import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 5,
  connect_timeout: 30,
  connection: {
    application_name: "probaly-app",
  },
});
export const db = drizzle(queryClient, { schema });
