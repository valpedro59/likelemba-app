import "dotenv/config"; // doit rester le premier import
import { app } from "./app.js";
import { pool } from "./db/index.js";

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Arrêt propre : on finit les requêtes en cours puis on ferme la connexion à la base
const shutdown = (signal: string) => {
  console.log(`${signal} reçu, arrêt en cours...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
