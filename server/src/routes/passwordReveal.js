const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { verifyToken, getClientIP } = require("../middleware/auth");
const { User, Credential, AuditLog } = require("../models");
const { encrypt, decrypt } = require("../utils/encryption");
const { sendEmailOTP, OTP_LENGTH } = require("../utils/otp");
const {
  getAllowedCategories,
} = require("../config/rolePermissions");

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60; // minimum gap between OTP sends
const REVEAL_TOKEN_EXPIRY = "2m"; // reveal token valid for 2 minutes

/**
 * Hash an OTP code with SHA-256 for secure storage.
 * We never store the plain OTP in the database.
 */
function hashOTP(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Generate a cryptographically secure numeric OTP.
 */
function generateSecureOTP() {
  const min = Math.pow(10, OTP_LENGTH - 1); // 100000
  const max = Math.pow(10, OTP_LENGTH);     // 1000000
  return crypto.randomInt(min, max).toString();
}

/**
 * Partially mask an email address for display.
 * e.g., "john.doe@gmail.com" → "jo****e@gmail.com"
 */
function maskEmail(email) {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(local.length - 3, 6))}${local.slice(-1)}@${domain}`;
}

// ──────────────────────────────────────────────
// POST /api/auth/password-reveal/request-otp
// ──────────────────────────────────────────────
// Generates a 6-digit OTP, hashes it, stores the hash,
// and sends the plain OTP to the user's registered email.
// ──────────────────────────────────────────────
router.post("/request-otp", async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { credentialId } = req.body;

    if (!credentialId) {
      return res.status(400).json({ message: "Credential ID is required." });
    }

    // Verify credential exists and user has access
    const credential = await Credential.findById(credentialId);
    if (!credential) {
      return res.status(404).json({ message: "Credential not found." });
    }

    // Fetch user with the passwordRevealOTP field
    const user = await User.findById(userId).select("+passwordRevealOTP.codeHash");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // ═══ Rate Limiting: Don't resend if cooldown hasn't elapsed ═══
    if (user.passwordRevealOTP?.lastSentAt) {
      const elapsed = Date.now() - new Date(user.passwordRevealOTP.lastSentAt).getTime();
      if (elapsed < OTP_COOLDOWN_SECONDS * 1000) {
        const waitSeconds = Math.ceil((OTP_COOLDOWN_SECONDS * 1000 - elapsed) / 1000);
        return res.status(429).json({
          message: `Please wait ${waitSeconds}s before requesting a new code.`,
          retryAfter: waitSeconds,
        });
      }
    }

    // Generate OTP
    const plainOTP = generateSecureOTP();
    const otpHash = hashOTP(plainOTP);

    // Store hashed OTP
    user.passwordRevealOTP = {
      codeHash: otpHash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      attempts: 0,
      credentialId: credentialId,
      used: false,
      lastSentAt: new Date(),
    };
    await user.save();

    // Send OTP to user's email
    await sendEmailOTP(user.email, plainOTP);

    res.status(200).json({
      message: "Verification code sent to your email.",
      email: maskEmail(user.email),
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    console.error("Request OTP error:", error);
    res.status(500).json({ message: "Failed to send verification code." });
  }
});

// ──────────────────────────────────────────────
// POST /api/auth/password-reveal/verify-otp
// ──────────────────────────────────────────────
// Validates the user-entered OTP against the stored hash.
// On success, issues a short-lived JWT "reveal token" that
// can be used exactly once to reveal the bound credential.
// ──────────────────────────────────────────────
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { code, credentialId } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ message: "Please enter a valid 6-digit code." });
    }

    if (!credentialId) {
      return res.status(400).json({ message: "Credential ID is required." });
    }

    // Fetch user with hashed OTP
    const user = await User.findById(userId).select("+passwordRevealOTP.codeHash");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const otpData = user.passwordRevealOTP;

    // ═══ Validate OTP exists ═══
    if (!otpData?.codeHash || !otpData?.expiresAt) {
      return res.status(400).json({
        message: "No verification code has been sent. Please request a new code.",
      });
    }

    // ═══ Validate OTP not already used ═══
    if (otpData.used) {
      return res.status(400).json({
        message: "This code has already been used. Please request a new code.",
      });
    }

    // ═══ Validate OTP is bound to the correct credential ═══
    if (otpData.credentialId !== credentialId) {
      return res.status(400).json({
        message: "Verification code does not match this credential. Please request a new code.",
      });
    }

    // ═══ Validate max attempts ═══
    if (otpData.attempts >= MAX_OTP_ATTEMPTS) {
      // Invalidate the OTP
      user.passwordRevealOTP = {
        codeHash: null,
        expiresAt: null,
        attempts: 0,
        credentialId: null,
        used: false,
        lastSentAt: otpData.lastSentAt,
      };
      await user.save();

      await AuditLog.create({
        userId,
        userRole: role,
        action: "VERIFICATION_FAILED",
        credentialId,
        details: "Password reveal OTP max attempts exceeded",
        ipAddress: getClientIP(req),
        result: "denied",
      });

      return res.status(400).json({
        message: "Too many failed attempts. Please request a new code.",
        maxAttemptsReached: true,
      });
    }

    // ═══ Validate OTP not expired ═══
    if (new Date() > new Date(otpData.expiresAt)) {
      await AuditLog.create({
        userId,
        userRole: role,
        action: "VERIFICATION_FAILED",
        credentialId,
        details: "Password reveal OTP expired",
        ipAddress: getClientIP(req),
        result: "denied",
      });

      return res.status(400).json({
        message: "Verification code has expired. Please request a new code.",
        expired: true,
      });
    }

    // ═══ Validate OTP matches (compare hashes) ═══
    const inputHash = hashOTP(code);
    if (inputHash !== otpData.codeHash) {
      // Increment attempts
      user.passwordRevealOTP.attempts = (otpData.attempts || 0) + 1;
      await user.save();

      const remaining = MAX_OTP_ATTEMPTS - user.passwordRevealOTP.attempts;

      await AuditLog.create({
        userId,
        userRole: role,
        action: "VERIFICATION_FAILED",
        credentialId,
        details: `Incorrect OTP for password reveal (${user.passwordRevealOTP.attempts}/${MAX_OTP_ATTEMPTS} attempts)`,
        ipAddress: getClientIP(req),
        result: "denied",
      });

      return res.status(400).json({
        message: "Incorrect verification code. Please try again.",
        attemptsRemaining: remaining,
      });
    }

    // ═══ SUCCESS — Mark OTP as used ═══
    user.passwordRevealOTP.used = true;
    await user.save();

    // Issue a short-lived reveal token
    const revealToken = jwt.sign(
      {
        userId,
        credentialId,
        purpose: "password_reveal",
        timestamp: Date.now(),
      },
      process.env.JWT_SECRET,
      { expiresIn: REVEAL_TOKEN_EXPIRY }
    );

    await AuditLog.create({
      userId,
      userRole: role,
      action: "VERIFICATION_SUCCESS",
      credentialId,
      details: "OTP verified for password reveal",
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({
      message: "Verification successful.",
      revealToken,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ message: "Verification failed. Please try again." });
  }
});

// ──────────────────────────────────────────────
// GET /api/auth/password-reveal/:credentialId/reveal
// ──────────────────────────────────────────────
// Returns the decrypted password ONLY if the caller
// presents a valid reveal token for this specific credential.
// The reveal token is single-use (bound to the OTP session).
// ──────────────────────────────────────────────
router.get("/:credentialId/reveal", async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { credentialId } = req.params;
    const revealToken = req.headers["x-reveal-token"];

    if (!revealToken) {
      return res.status(401).json({ message: "Reveal token is required." });
    }

    // Verify the reveal token
    let decoded;
    try {
      decoded = jwt.verify(revealToken, process.env.JWT_SECRET);
    } catch (jwtError) {
      await AuditLog.create({
        userId,
        userRole: role,
        action: "VERIFICATION_FAILED",
        credentialId,
        details: "Invalid or expired reveal token",
        ipAddress: getClientIP(req),
        result: "denied",
      });

      return res.status(403).json({ message: "Invalid or expired reveal token. Please verify again." });
    }

    // Validate token purpose and binding
    if (decoded.purpose !== "password_reveal") {
      return res.status(403).json({ message: "Invalid token purpose." });
    }
    if (decoded.userId !== userId) {
      return res.status(403).json({ message: "Token does not belong to this user." });
    }
    if (decoded.credentialId !== credentialId) {
      return res.status(403).json({ message: "Token is not valid for this credential." });
    }

    // Fetch the credential
    const credential = await Credential.findById(credentialId);
    if (!credential) {
      return res.status(404).json({ message: "Credential not found." });
    }

    // ═══ RBAC: Verify user has access to this credential ═══
    if (role !== "super_admin") {
      const user = await User.findById(userId);
      const isOwner = credential.addedBy?.toString() === userId;
      const isSameTeam = user.teamId && credential.teamId &&
        user.teamId.toString() === credential.teamId.toString();

      if (role === "admin") {
        if (credential.addedByRole === "super_admin" && credential.accessLevel === "restricted") {
          return res.status(403).json({ message: "Access denied to this credential." });
        }
      } else if (role === "manager") {
        if (!isOwner && !isSameTeam) {
          return res.status(403).json({ message: "Access denied to this credential." });
        }
      } else if (role === "developer") {
        const allowedCategories = getAllowedCategories("developer");
        if (!isOwner && (!isSameTeam || !allowedCategories.includes(credential.category))) {
          return res.status(403).json({ message: "Access denied to this credential." });
        }
      } else {
        // Employee
        if (!isOwner && !isSameTeam) {
          return res.status(403).json({ message: "Access denied to this credential." });
        }
        const allowedCategories = getAllowedCategories("employee");
        if (!isOwner && !allowedCategories.includes(credential.category)) {
          return res.status(403).json({ message: "Access denied to this credential." });
        }
      }
    }

    // Decrypt the password
    let decryptedPassword;
    try {
      decryptedPassword = decrypt(credential.encryptedPassword);
    } catch {
      decryptedPassword = "[decryption failed]";
    }

    // Log successful password reveal
    await AuditLog.create({
      userId,
      userRole: role,
      action: "PASSWORD_REVEALED",
      credentialId,
      resource: "credential",
      resourceId: credential._id.toString(),
      details: `Password revealed for: ${credential.credentialName}`,
      ipAddress: getClientIP(req),
      result: "success",
    });

    // Invalidate the OTP data after successful reveal
    // (prevents token replay — the OTP was already marked used)
    const userForCleanup = await User.findById(userId);
    if (userForCleanup?.passwordRevealOTP?.credentialId === credentialId) {
      userForCleanup.passwordRevealOTP = {
        codeHash: null,
        expiresAt: null,
        attempts: 0,
        credentialId: null,
        used: false,
        lastSentAt: userForCleanup.passwordRevealOTP.lastSentAt,
      };
      await userForCleanup.save();
    }

    res.status(200).json({
      message: "Password revealed successfully.",
      password: decryptedPassword,
    });
  } catch (error) {
    console.error("Reveal password error:", error);
    res.status(500).json({ message: "Server error during password reveal." });
  }
});

module.exports = router;
