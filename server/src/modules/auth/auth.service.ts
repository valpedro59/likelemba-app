import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { AppError } from "../../lib/AppError.js";
import { otpCodes, users } from "../../db/schema.js";

type MomoProvider = "MTN" | "AIRTEL";

const OTP_TTL_MS = 5 * 60 * 1000; // validité du code
const RESEND_DELAY_MS = 60 * 1000; // délai minimum entre deux demandes
const MAX_ATTEMPTS = 5; // essais par code

// Hérite du constructeur (message, status) de AppError
export class AuthError extends AppError {}

/* -------------------------------------------------------------------------- */
/*  Utilitaires                                                               */
/* -------------------------------------------------------------------------- */

function hashCode(phone: string, code: string): string {
  const secret = process.env.OTP_SECRET;
  if (!secret) {
    throw new Error("OTP_SECRET is missing in environment variables");
  }
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// À remplacer par votre fournisseur SMS (Twilio, Infobip, SMS.to...)
async function sendOtpSms(phone: string, code: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[OTP] ${phone} -> ${code}`);
    return;
  }
  throw new Error("Aucun fournisseur SMS configuré");
}

/* -------------------------------------------------------------------------- */
/*  1. Demande de code (inscription ou connexion)                             */
/*     Le numéro doit déjà être normalisé en E.164 (+242...)                  */
/* -------------------------------------------------------------------------- */

export async function requestOtp(input: {
  phone: string;
  fullName?: string;
  momoProvider?: MomoProvider;
}) {
  const { phone, fullName, momoProvider } = input;

  // Anti-spam : un seul envoi par minute et par numéro
  const [recent] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_DELAY_MS) {
    throw new AuthError(
      "Veuillez patienter avant de demander un nouveau code",
      429,
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  // Pour une inscription, on garde nom et opérateur AVEC le code.
  // Aucun compte n'est créé tant que le numéro n'est pas vérifié.
  if (!existing && (!fullName || !momoProvider)) {
    throw new AuthError("Nom et opérateur requis pour l'inscription", 400);
  }

  // Code fixe pour les tests : uniquement si NODE_ENV vaut explicitement "development"
  // ET si OTP_DEV_CODE est défini. Jamais actif en production.
  const devCode =
    process.env.NODE_ENV === "development"
      ? process.env.OTP_DEV_CODE
      : undefined;
  const code =
    devCode && /^\d{6}$/.test(devCode)
      ? devCode
      : randomInt(0, 1_000_000).toString().padStart(6, "0");

  await db.transaction(async (trx) => {
    await trx.delete(otpCodes).where(eq(otpCodes.phone, phone));
    await trx.insert(otpCodes).values({
      phone,
      codeHash: hashCode(phone, code),
      fullName: existing ? null : (fullName ?? null),
      momoProvider: existing ? null : (momoProvider ?? null),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
  });

  await sendOtpSms(phone, code);
  return { success: true };
}

/* -------------------------------------------------------------------------- */
/*  2. Vérification du code : crée ou met à jour l'utilisateur                */
/* -------------------------------------------------------------------------- */

export async function verifyOtp(phone: string, code: string) {
  const [record] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  // Message volontairement générique : ne révèle rien sur l'état du numéro
  if (!record) throw new AuthError("Code invalide ou expiré", 400);

  // Incrément atomique : bloque les essais parallèles au-delà de la limite
  const [attempt] = await db
    .update(otpCodes)
    .set({ attempts: sql`${otpCodes.attempts} + 1` })
    .where(and(eq(otpCodes.id, record.id), lt(otpCodes.attempts, MAX_ATTEMPTS)))
    .returning({ id: otpCodes.id });

  if (!attempt) {
    await db.delete(otpCodes).where(eq(otpCodes.id, record.id));
    throw new AuthError("Trop de tentatives, demandez un nouveau code", 429);
  }

  if (!safeEqual(record.codeHash, hashCode(phone, code))) {
    throw new AuthError("Code invalide ou expiré", 400);
  }

  return db.transaction(async (trx) => {
    // Le code ne peut servir qu'une seule fois, même avec deux requêtes simultanées
    const [consumed] = await trx
      .delete(otpCodes)
      .where(eq(otpCodes.id, record.id))
      .returning({ id: otpCodes.id });
    if (!consumed) throw new AuthError("Code invalide ou expiré", 400);

    const now = new Date();

    const [existing] = await trx
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    if (existing) {
      const [updated] = await trx
        .update(users)
        .set({ phoneVerifiedAt: existing.phoneVerifiedAt ?? now })
        .where(eq(users.id, existing.id))
        .returning();
      if (!updated) throw new AuthError("Utilisateur introuvable", 404);
      return { user: updated, isNew: false };
    }

    if (!record.fullName || !record.momoProvider) {
      throw new AuthError("Inscription incomplète, veuillez recommencer", 400);
    }

    const [created] = await trx
      .insert(users)
      .values({
        fullName: record.fullName,
        phone,
        momoProvider: record.momoProvider,
        phoneVerifiedAt: now,
      })
      .onConflictDoNothing({ target: users.phone })
      .returning();

    // Conflit : un autre appel a créé le compte au même instant
    if (!created) throw new AuthError("Veuillez réessayer", 409);
    return { user: created, isNew: true };
  });
}

/* -------------------------------------------------------------------------- */
/*  3. Lecture d'un utilisateur (pour /auth/me)                               */
/* -------------------------------------------------------------------------- */

export async function getUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

  // Token valide mais compte supprimé : on considère la session invalide
  if (!user) throw new AuthError("Utilisateur introuvable", 401);

  return user;
}
