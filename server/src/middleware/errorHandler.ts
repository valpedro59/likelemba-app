import type { ErrorRequestHandler } from "express";
import { AppError } from "../lib/AppError.js";

// À brancher EN DERNIER : app.use(errorHandler)
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  // Erreur inattendue : on journalise, mais on ne révèle rien au client
  console.error(err);
  res.status(500).json({ message: "Erreur interne du serveur" });
};
