import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { providerEnum } from "../../db/schema.js";

// Accepte "06 123 45 67", "+242 06 123 45 67"... et renvoie du E.164 (+242...)
// isPossible() plutôt qu'isValid() : les plages de numéros évoluent et les
// métadonnées peuvent être en retard sur les nouveaux préfixes MTN / Airtel.
const phoneSchema = z.string().transform((value, ctx) => {
  const parsed = parsePhoneNumberFromString(value, "CG");

  if (!parsed || !parsed.isPossible() || parsed.countryCallingCode !== "242") {
    ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide" });
    return z.NEVER;
  }

  return parsed.number;
});

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  fullName: z.string().trim().min(2).max(255).optional(),
  // Les valeurs viennent de l'enum Drizzle : une seule source de vérité
  momoProvider: z.enum(providerEnum.enumValues).optional(),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Le code doit contenir 6 chiffres"),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
