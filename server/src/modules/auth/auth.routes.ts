import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { otpRateLimit } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";
import { requestOtpSchema, verifyOtpSchema } from "./auth.schema.js";
import {
  logoutHandler,
  meHandler,
  requestOtpHandler,
  verifyOtpHandler,
} from "./auth.controller.js";

const router: Router = Router();

// Ordre : limite de débit -> validation -> contrôleur
router.post(
  "/otp/request",
  otpRateLimit,
  validate(requestOtpSchema),
  asyncHandler(requestOtpHandler),
);

router.post(
  "/otp/verify",
  otpRateLimit,
  validate(verifyOtpSchema),
  asyncHandler(verifyOtpHandler),
);

// Routes protégées : requireAuth passe en premier
router.get("/me", requireAuth, asyncHandler(meHandler));
router.post("/logout", requireAuth, logoutHandler);

export default router;
