import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { sql } from "drizzle-orm";
import authRoutes from "./modules/auth/auth.routes.js";
import { db } from "./db/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app: Express = express();

// Derrière un proxy (Render, Railway, Nginx...) : nécessaire pour rateLimit
app.set("trust proxy", 1);

// En-têtes de sécurité HTTP
app.use(helmet());

// credentials: true est obligatoire pour que le navigateur envoie le cookie de session,
// et il impose une origine précise (pas de "*")
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);

// Limite la taille des corps JSON
app.use(express.json({ limit: "10kb" }));

// Rend le cookie de session lisible via req.cookies (utilisé par requireAuth)
app.use(cookieParser());

// Health check et test de connexion à Neon
app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`SELECT NOW() AS now`);
    res.status(200).json({
      status: "success",
      message: "Likelemba API is running",
      timestamp: result.rows[0]?.now,
    });
  } catch (error) {
    // Le détail reste dans les logs, pas dans la réponse
    console.error("Database connection error:", error);
    res.status(500).json({
      status: "error",
      message: "Database connection failed",
    });
  }
});

app.use("/auth", authRoutes);

// Toujours en dernier
app.use(errorHandler);
