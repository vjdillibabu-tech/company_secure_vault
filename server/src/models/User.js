const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-zA-Z][a-zA-Z0-9_-]{2,29}$/,
        "Username must start with a letter and contain only letters, numbers, underscores, or hyphens",
      ],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // exclude from queries by default
    },
    role: {
      type: String,
      enum: {
        values: ["super_admin", "admin", "manager", "developer", "employee"],
        message: "{VALUE} is not a valid role",
      },
      default: "employee",
    },
    // The role the user originally requested during registration.
    // Privileged roles require admin approval; until then, the
    // effective role defaults to "employee".
    requestedRole: {
      type: String,
      enum: {
        values: ["super_admin", "admin", "manager", "developer", "employee"],
        message: "{VALUE} is not a valid role",
      },
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ["active", "inactive", "suspended", "pending_approval"],
        message: "{VALUE} is not a valid status",
      },
      default: "active",
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    profilePicture: {
      type: String,
      default: null, // Stores base64 data URL (e.g. "data:image/png;base64,...")
    },

    // ── Email verification ──────────────────────────
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailOTP: {
      code: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
    },

    // ── Password reveal OTP ────────────────────────
    // Separate from email verification OTP — used for
    // identity verification before revealing credential passwords.
    // The code is stored as a SHA-256 hash, never plain text.
    passwordRevealOTP: {
      codeHash: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
      credentialId: { type: String, default: null }, // binds OTP to a specific credential
      used: { type: Boolean, default: false },
      lastSentAt: { type: Date, default: null }, // rate-limiting: track when last OTP was sent
    },

    // ── Phone verification ──────────────────────────
    phoneNumber: {
      type: String,
      default: null,
      trim: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    phoneOTP: {
      code: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
    },

    // ── Google OAuth ──────────────────────────────
    googleId: {
      type: String,
      default: null,
      index: true,
    },
    googleEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    googleAccessToken: {
      type: String,
      default: null,
      select: false, // Never expose access token in queries
    },
    googleRefreshToken: {
      type: String,
      default: null,
      select: false, // Never expose refresh token in queries
    },
    googleProvider: {
      type: String,
      enum: ["google", null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
