import type { NextFunction, Request, RequestHandler, Response } from "express";

// Envoie les erreurs des fonctions async vers errorHandler (utile avec Express 4 et 5)
export const asyncHandler =
  (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
