const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    userRole: {
      type: String,
      enum: {
        values: ["super_admin", "admin", "manager", "developer", "employee"],
        message: "{VALUE} is not a valid role",
      },
      default: null,
    },
    action: {
      type: String,
      required: [true, "Action is required"],
      enum: {
        values: [
          "CREATE_CREDENTIAL",
          "VIEW_CREDENTIAL",
          "UPDATE_CREDENTIAL",
          "DELETE_CREDENTIAL",
          "SHARE_CREDENTIAL",
          "REGISTER",
          "LOGIN",
          "LOGOUT",
          "CREATE_TEAM",
          "UPDATE_TEAM",
          "ADD_MEMBER",
          "REMOVE_MEMBER",
          "PROFILE_UPDATE",
          "PASSWORD_CHANGE",
          "ROLE_CHANGE",
          "ASSIGN_ROLE",
          "ACCESS_REQUESTED",
          "ACCESS_APPROVED",
          "ACCESS_REJECTED",
          "TEMP_ACCESS_GRANTED",
          "TEMP_ACCESS_EXPIRED",
          "UNAUTHORIZED_ATTEMPT",
          "PASSWORD_REVEALED",
          "PASSWORD_UPDATED",
          "VERIFICATION_FAILED",
          "VERIFICATION_SUCCESS",
          "GOOGLE_ACCOUNT_LINKED",
          "GOOGLE_ACCOUNT_UNLINKED",
        ],
        message: "{VALUE} is not a valid audit action",
      },
    },
    credentialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Credential",
      default: null, // null for non-credential actions (LOGIN, LOGOUT, etc.)
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // the user whose role was changed (for ROLE_CHANGE / ASSIGN_ROLE)
    },
    resource: {
      type: String,
      default: null, // resource type (e.g. "credential", "team", "user")
    },
    resourceId: {
      type: String,
      default: null, // generic resource ID (for non-credential resources)
    },
    details: {
      type: String,
      default: null, // optional extra info (e.g. "role changed from employee to manager")
    },
    ipAddress: {
      type: String,
      default: null,
    },
    result: {
      type: String,
      enum: {
        values: ["success", "failure", "denied"],
        message: "{VALUE} is not a valid result",
      },
      default: "success",
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    // No updatedAt — audit logs are immutable
    timestamps: false,
  }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
