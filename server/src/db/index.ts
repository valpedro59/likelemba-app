import net from "node:net";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in environment variables");
}
net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

neonConfig.webSocketConstructor = ws;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
});

// Évite qu'une coupure réseau sur une connexion inactive fasse planter le serveur
pool.on("error", (err: Error) => {
  console.error("Erreur du pool Neon :", err);
});
export const db = drizzle({ client: pool });
