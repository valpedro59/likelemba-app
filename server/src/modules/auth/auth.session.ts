import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import { SESSION_COOKIE } from "../../lib/session.js";

const SESSION_DAYS = 30;

// Mêmes options à l'émission et à la suppression, sinon le navigateur ne retire pas le cookie
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

// Version minimale : un JWT dans un cookie HttpOnly.
// À faire évoluer plus tard (token court + refresh token, révocation).
export function issueSession(res: Response, userId: string): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables");
  }

  const token = jwt.sign({ sub: userId }, secret, {
    algorithm: "HS256",
    expiresIn: SESSION_DAYS * 24 * 60 * 60, // en secondes
  });

  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000, // en millisecondes
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}
