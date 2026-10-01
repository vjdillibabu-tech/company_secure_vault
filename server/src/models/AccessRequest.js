const mongoose = require("mongoose");

const accessRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Requester is required"],
      index: true,
    },
    // What type of access is being requested
    requestType: {
      type: String,
      enum: {
        values: ["production_credential", "restricted_resource", "temporary_access"],
        message: "{VALUE} is not a valid request type",
      },
      required: [true, "Request type is required"],
    },
    // Category of credential being requested
    category: {
      type: String,
      required: [true, "Category is required"],
    },
    // Description of what is needed and why
    reason: {
      type: String,
      required: [true, "Reason for access is required"],
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
    // Resource name / credential name being requested
    resourceName: {
      type: String,
      required: [true, "Resource name is required"],
      trim: true,
    },
    // Current status
    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected", "expired"],
        message: "{VALUE} is not a valid status",
      },
      default: "pending",
      index: true,
    },
    // Who reviewed it
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      default: null,
    },
    // For temporary access: when does it expire?
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AccessRequest", accessRequestSchema);
