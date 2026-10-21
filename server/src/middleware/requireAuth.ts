import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../lib/AppError.js";
import { SESSION_COOKIE } from "../lib/session.js";

// Protège une route : lit le cookie de session, vérifie le JWT,
// puis place l'identifiant de l'utilisateur dans res.locals.userId.
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string") {
    throw new AppError("Non authentifié", 401);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }

  let userId: string;
  try {
    // On impose l'algorithme : un token signé autrement est refusé
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new Error("Payload invalide");
    }
    userId = payload.sub;
  } catch {
    throw new AppError("Session invalide ou expirée", 401);
  }

  res.locals.userId = userId;
  next();
};

// À utiliser dans les contrôleurs protégés : renvoie l'id typé "string"
export const getUserId = (res: Response): string => {
  const id: unknown = res.locals.userId;
  if (typeof id !== "string") {
    throw new AppError("Non authentifié", 401);
  }
  return id;
};
