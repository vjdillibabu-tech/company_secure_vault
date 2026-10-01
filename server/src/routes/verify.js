const express = require("express");
const { User, AuditLog } = require("../models");
const { verifyToken, getClientIP } = require("../middleware/auth");
const {
  generateOTP,
  getOTPExpiry,
  validateOTP,
  sendEmailOTP,
  sendPhoneOTP,
  OTP_EXPIRY_MINUTES,
} = require("../utils/otp");

const router = express.Router();

// ──────────────────────────────────────────────
// POST /api/verify/email/send — Send email verification OTP
// ──────────────────────────────────────────────
// Generates a 6-digit OTP and "sends" it to the user's email.
// In dev mode, the OTP is logged to the server console.
// ──────────────────────────────────────────────
router.post("/email/send", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("+emailOTP.code");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    // Rate limit: don't resend if the previous OTP was sent less than 60s ago
    if (user.emailOTP?.expiresAt) {
      const sentAgo = Date.now() - (new Date(user.emailOTP.expiresAt).getTime() - OTP_EXPIRY_MINUTES * 60 * 1000);
      if (sentAgo < 60 * 1000) {
        const waitSeconds = Math.ceil((60 * 1000 - sentAgo) / 1000);
        return res.status(429).json({
          message: `Please wait ${waitSeconds}s before requesting a new code.`,
          retryAfter: waitSeconds,
        });
      }
    }

    const otp = generateOTP();

    // Store OTP (hashed would be ideal for production, plain for dev simplicity)
    user.emailOTP = {
      code: otp,
      expiresAt: getOTPExpiry(),
      attempts: 0,
    };
    await user.save();

    // Send the OTP
    await sendEmailOTP(user.email, otp);

    res.status(200).json({
      message: "Verification code sent to your email.",
      expiresInMinutes: OTP_EXPIRY_MINUTES,
      // DEV ONLY: Include OTP in response for easy testing
      // Remove this in production!
      ...(process.env.NODE_ENV !== "production" && { devOTP: otp }),
    });
  } catch (error) {
    console.error("Send email OTP error:", error);
    res.status(500).json({ message: "Failed to send verification code." });
  }
});

// ──────────────────────────────────────────────
// POST /api/verify/email/verify — Verify email OTP
// ──────────────────────────────────────────────
router.post("/email/verify", verifyToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ message: "Please enter a valid 6-digit code." });
    }

    const user = await User.findById(req.user.userId).select("+emailOTP.code");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    const { valid, error } = validateOTP(
      user.emailOTP?.code,
      user.emailOTP?.expiresAt,
      user.emailOTP?.attempts || 0,
      code
    );

    if (!valid) {
      // Increment attempts
      user.emailOTP.attempts = (user.emailOTP.attempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: error });
    }

    // ═══ SUCCESS — Mark email as verified ═══
    user.emailVerified = true;
    user.emailOTP = { code: null, expiresAt: null, attempts: 0 };
    await user.save();

    // Audit log
    await AuditLog.create({
      userId: user._id,
      userRole: user.role,
      action: "PROFILE_UPDATE",
      details: "Email verified via OTP",
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({
      message: "Email verified successfully!",
      emailVerified: true,
    });
  } catch (error) {
    console.error("Verify email OTP error:", error);
    res.status(500).json({ message: "Verification failed. Please try again." });
  }
});

// ──────────────────────────────────────────────
// POST /api/verify/phone/send — Send phone verification OTP
// ──────────────────────────────────────────────
router.post("/phone/send", verifyToken, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || phoneNumber.length < 10) {
      return res.status(400).json({ message: "Please enter a valid phone number." });
    }

    const user = await User.findById(req.user.userId).select("+phoneOTP.code");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.phoneVerified) {
      return res.status(400).json({ message: "Phone is already verified." });
    }

    // Rate limit
    if (user.phoneOTP?.expiresAt) {
      const sentAgo = Date.now() - (new Date(user.phoneOTP.expiresAt).getTime() - OTP_EXPIRY_MINUTES * 60 * 1000);
      if (sentAgo < 60 * 1000) {
        const waitSeconds = Math.ceil((60 * 1000 - sentAgo) / 1000);
        return res.status(429).json({
          message: `Please wait ${waitSeconds}s before requesting a new code.`,
          retryAfter: waitSeconds,
        });
      }
    }

    const otp = generateOTP();

    // Save phone number and OTP
    user.phoneNumber = phoneNumber;
    user.phoneOTP = {
      code: otp,
      expiresAt: getOTPExpiry(),
      attempts: 0,
    };
    await user.save();

    // Send the OTP
    await sendPhoneOTP(phoneNumber, otp);

    res.status(200).json({
      message: "Verification code sent to your phone.",
      expiresInMinutes: OTP_EXPIRY_MINUTES,
      // DEV ONLY: Include OTP in response for easy testing
      ...(process.env.NODE_ENV !== "production" && { devOTP: otp }),
    });
  } catch (error) {
    console.error("Send phone OTP error:", error);
    res.status(500).json({ message: "Failed to send verification code." });
  }
});

// ──────────────────────────────────────────────
// POST /api/verify/phone/verify — Verify phone OTP
// ──────────────────────────────────────────────
router.post("/phone/verify", verifyToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ message: "Please enter a valid 6-digit code." });
    }

    const user = await User.findById(req.user.userId).select("+phoneOTP.code");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.phoneVerified) {
      return res.status(400).json({ message: "Phone is already verified." });
    }

    const { valid, error } = validateOTP(
      user.phoneOTP?.code,
      user.phoneOTP?.expiresAt,
      user.phoneOTP?.attempts || 0,
      code
    );

    if (!valid) {
      user.phoneOTP.attempts = (user.phoneOTP.attempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: error });
    }

    // ═══ SUCCESS — Mark phone as verified ═══
    user.phoneVerified = true;
    user.phoneOTP = { code: null, expiresAt: null, attempts: 0 };
    await user.save();

    // Audit log
    await AuditLog.create({
      userId: user._id,
      userRole: user.role,
      action: "PROFILE_UPDATE",
      details: "Phone verified via OTP",
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({
      message: "Phone verified successfully!",
      phoneVerified: true,
    });
  } catch (error) {
    console.error("Verify phone OTP error:", error);
    res.status(500).json({ message: "Verification failed. Please try again." });
  }
});

// ──────────────────────────────────────────────
// GET /api/verify/status — Get verification status
// ──────────────────────────────────────────────
router.get("/status", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      phoneNumber: user.phoneNumber,
      email: user.email,
    });
  } catch (error) {
    console.error("Get verification status error:", error);
    res.status(500).json({ message: "Failed to fetch verification status." });
  }
});

// ──────────────────────────────────────────────
// POST /api/verify/skip — Skip verification (for now)
// ──────────────────────────────────────────────
// Allows users to skip the OTP steps and go directly to dashboard.
// They can verify later from their profile page.
// ──────────────────────────────────────────────
router.post("/skip", verifyToken, async (req, res) => {
  try {
    res.status(200).json({
      message: "Verification skipped. You can verify later from your profile.",
      skipped: true,
    });
  } catch (error) {
    console.error("Skip verification error:", error);
    res.status(500).json({ message: "Failed to skip verification." });
  }
});

module.exports = router;
