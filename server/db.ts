import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const queryClient = postgres(process.env.DATABASE_URL, {
  // Allow up to 20 concurrent DB connections. At max:10 even moderate traffic
  // (e.g. 50 concurrent API requests each doing 1-2 DB queries) stalls on
  // connection-pool waits. 20 keeps the pool saturated only under heavy load.
  max: 20,
  idle_timeout: 20,
  max_lifetime: 60 * 5,
  connect_timeout: 30,
  connection: {
    application_name: "probaly-app",
  },
});
export const db = drizzle(queryClient, { schema });
