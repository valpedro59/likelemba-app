import type { Request, Response } from "express";
import { getUserId } from "../../middleware/requireAuth.js";
import { getUserById, requestOtp, verifyOtp } from "./auth.service.js";
import type { RequestOtpInput, VerifyOtpInput } from "./auth.schema.js";
import { clearSession, issueSession } from "./auth.session.js";

// req.body a déjà été validé et normalisé par le middleware validate()

export const requestOtpHandler = async (req: Request, res: Response) => {
  const input = req.body as RequestOtpInput;

  await requestOtp({
    phone: input.phone,
    ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
    ...(input.momoProvider !== undefined
      ? { momoProvider: input.momoProvider }
      : {}),
  });

  res.status(200).json({ message: "Code envoyé par SMS" });
};

// On ne renvoie que ce dont le frontend a besoin
const toPublicUser = (user: Awaited<ReturnType<typeof getUserById>>) => ({
  id: user.id,
  fullName: user.fullName,
  phone: user.phone,
  momoProvider: user.momoProvider,
});

export const verifyOtpHandler = async (req: Request, res: Response) => {
  const { phone, code } = req.body as VerifyOtpInput;

  const { user, isNew } = await verifyOtp(phone, code);

  issueSession(res, user.id);

  res.status(isNew ? 201 : 200).json({ isNew, user: toPublicUser(user) });
};

// Route protégée par requireAuth : renvoie l'utilisateur connecté
export const meHandler = async (_req: Request, res: Response) => {
  const user = await getUserById(getUserId(res));

  res.status(200).json({ user: toPublicUser(user) });
};

export const logoutHandler = (_req: Request, res: Response) => {
  clearSession(res);

  res.status(200).json({ message: "Déconnecté" });
};
