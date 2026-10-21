import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

// Valide req.body avec un schéma Zod avant d'atteindre le contrôleur.
// En cas de succès, req.body est remplacé par les données nettoyées et normalisées.
export const validate =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: "Données invalides",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    req.body = result.data;
    next();
  };
