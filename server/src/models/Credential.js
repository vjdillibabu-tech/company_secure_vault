const mongoose = require("mongoose");

const credentialSchema = new mongoose.Schema(
  {
    // ── Core fields ──────────────────────────────────
    credentialName: {
      type: String,
      required: [true, "Credential name is required"],
      trim: true,
      maxlength: [200, "Credential name cannot exceed 200 characters"],
    },
    // Keep `siteName` as an alias for backward compat
    siteName: {
      type: String,
      trim: true,
      maxlength: [200, "Site name cannot exceed 200 characters"],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
    },
    encryptedPassword: {
      type: String,
      required: [true, "Encrypted password is required"],
    },
    websiteUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // ── Role-based category ──────────────────────────
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
    },

    // ── Environment ──────────────────────────────────
    environment: {
      type: String,
      enum: {
        values: ["development", "testing", "staging", "production", ""],
        message: "{VALUE} is not a valid environment",
      },
      default: "",
    },

    // ── Access level ─────────────────────────────────
    accessLevel: {
      type: String,
      enum: {
        values: [
          "private", "team", "department", "company", "restricted",
          "manager_only", "team_members", "selected_employees",
          "shared_with_team", "",
        ],
        message: "{VALUE} is not a valid access level",
      },
      default: "private",
    },

    // ── Team / Project / Owner ───────────────────────
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true,
    },
    project: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: null,
    },

    // ── Ownership / audit ────────────────────────────
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Must track who added the credential"],
    },
    addedByRole: {
      type: String,
      enum: {
        values: ["super_admin", "admin", "manager", "developer", "employee"],
        message: "{VALUE} is not a valid role",
      },
      required: true,
    },

    // ── Security fields ──────────────────────────────
    compromised: {
      type: Boolean,
      default: false,
    },
    breachCount: {
      type: Number,
      default: 0,
    },
    breachCheckFailed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // provides createdAt and updatedAt
  }
);

// Backward compat — use siteName if credentialName is not set
credentialSchema.pre("save", function () {
  if (!this.credentialName && this.siteName) {
    this.credentialName = this.siteName;
  }
  if (!this.siteName && this.credentialName) {
    this.siteName = this.credentialName;
  }
});

module.exports = mongoose.model("Credential", credentialSchema);
