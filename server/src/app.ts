import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";

export const app: Express = express();

app.use(cors());
app.use(express.json());

// Route de test de santé (Health check & DB connection test)
app.get("/api/health", async (req: Request, res: Response) => {
  try {
    // Test simple de la connexion à Neon
    const result = await db.execute(`SELECT NOW()`);
    res.status(200).json({
      status: "success",
      message: "Likelemba API is running smoothly 🚀",
      database: "Connected to Neon PostgreSQL",
      timestamp: result.rows[0],
    });
  } catch (error: any) {
    console.error("Database connection error:", error);
    res.status(500).json({
      status: "error",
      message: "Database connection failed",
      error: error.message,
    });
  }
});

app.get("/api", (req: Request, res: Response) => res.send("Api test"));
