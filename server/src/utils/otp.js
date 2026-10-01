const crypto = require("crypto");
const nodemailer = require("nodemailer");

// ──────────────────────────────────────────────
// OTP Configuration
// ──────────────────────────────────────────────
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

/**
 * Generate a cryptographically secure numeric OTP.
 * Uses crypto.randomInt for uniform distribution.
 */
function generateOTP() {
  const min = Math.pow(10, OTP_LENGTH - 1); // 100000
  const max = Math.pow(10, OTP_LENGTH);     // 1000000
  return crypto.randomInt(min, max).toString();
}

/**
 * Get the expiry date for a new OTP.
 */
function getOTPExpiry() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

/**
 * Validate an OTP code against stored data.
 * Returns { valid, error } where error explains the failure reason.
 */
function validateOTP(storedCode, storedExpiresAt, storedAttempts, inputCode) {
  if (!storedCode || !storedExpiresAt) {
    return { valid: false, error: "No OTP has been sent. Please request a new code." };
  }

  if (storedAttempts >= MAX_OTP_ATTEMPTS) {
    return { valid: false, error: "Too many failed attempts. Please request a new code." };
  }

  if (new Date() > new Date(storedExpiresAt)) {
    return { valid: false, error: "OTP has expired. Please request a new code." };
  }

  if (storedCode !== inputCode) {
    return { valid: false, error: "Invalid OTP code. Please try again." };
  }

  return { valid: true, error: null };
}

// ──────────────────────────────────────────────
// Nodemailer transporter (lazy-initialized)
// ──────────────────────────────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null; // No SMTP configured — fall back to console
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return _transporter;
}

/**
 * Send an email OTP to the user.
 *
 * If SMTP is configured (SMTP_HOST, SMTP_USER, SMTP_PASS env vars),
 * sends a real email via Nodemailer.
 *
 * Otherwise, falls back to logging the OTP to the server console
 * for development/testing.
 */
async function sendEmailOTP(email, otp) {
  const transporter = getTransporter();

  if (transporter) {
    // ════════════════════════════════════════════════
    // PRODUCTION MODE: Send real email via Nodemailer
    // ════════════════════════════════════════════════
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transporter.sendMail({
      from,
      to: email,
      subject: "Company Vault — Verification Code",
      text: [
        "Your Company Vault verification code is:",
        "",
        `    ${otp}`,
        "",
        `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        "",
        "If you did not request this code, please ignore this email",
        "and ensure your account is secure.",
        "",
        "— Company Vault Security",
      ].join("\n"),
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #6366f1); border-radius: 12px; padding: 12px; margin-bottom: 16px;">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <h2 style="color: #1f2937; font-size: 20px; font-weight: 700; margin: 0;">Verification Code</h2>
          </div>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            To view this password, verify your identity using the code below:
          </p>
          <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1f2937; font-family: 'Courier New', monospace;">${otp}</span>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-bottom: 4px;">
            This code expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
          </p>
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            If you did not request this code, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #d1d5db; font-size: 11px; text-align: center;">
            Company Vault Security — Do not share this code with anyone.
          </p>
        </div>
      `,
    });

    // NOTE: We intentionally do NOT log the OTP value here.
    console.log(`📧 OTP email sent to ${email}`);

    return { success: true, message: "OTP sent to email" };
  }

  // ════════════════════════════════════════════════
  // DEVELOPMENT MODE: Log OTP to console
  // In production, configure SMTP_* env vars
  // ════════════════════════════════════════════════
  console.log(`\n📧 ─── EMAIL OTP ───────────────────────────`);
  console.log(`   To:   ${email}`);
  console.log(`   Code: ${otp}`);
  console.log(`   Expires in: ${OTP_EXPIRY_MINUTES} minutes`);
  console.log(`───────────────────────────────────────────\n`);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  return { success: true, message: "OTP sent to email (dev: see server console)" };
}

/**
 * Simulate sending a phone OTP via SMS.
 * In production, integrate with Twilio, AWS SNS, etc.
 * For development, logs the OTP to the server console.
 */
async function sendPhoneOTP(phoneNumber, otp) {
  // ════════════════════════════════════════════════
  // DEVELOPMENT MODE: Log OTP to console
  // In production, replace with actual SMS delivery
  // ════════════════════════════════════════════════
  console.log(`\n📱 ─── PHONE OTP ──────────────────────────`);
  console.log(`   To:   ${phoneNumber}`);
  console.log(`   Code: ${otp}`);
  console.log(`   Expires in: ${OTP_EXPIRY_MINUTES} minutes`);
  console.log(`───────────────────────────────────────────\n`);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  return { success: true, message: "OTP sent to phone (dev: see server console)" };
}

module.exports = {
  generateOTP,
  getOTPExpiry,
  validateOTP,
  sendEmailOTP,
  sendPhoneOTP,
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  MAX_OTP_ATTEMPTS,
};
