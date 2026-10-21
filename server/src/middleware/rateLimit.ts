import rateLimit from "express-rate-limit";

// Limite par adresse IP, en plus de la limite par numéro dans auth.service.ts
export const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Trop de requêtes, réessayez dans quelques minutes" },
});
