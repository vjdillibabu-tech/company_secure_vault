const express = require("express");
const jwt = require("jsonwebtoken");
const {
  verifyToken, denyRole, requireRole, authorizeRole,
  getClientIP, ROLE_HIERARCHY,
} = require("../middleware/auth");
const { Credential, AuditLog, User, AccessRequest } = require("../models");
const { encrypt, decrypt } = require("../utils/encryption");
const { checkBreach } = require("../utils/breachCheck");
const {
  ROLE_PERMISSIONS,
  getAllowedCategories,
  getAllowedAccessLevels,
  canCreateInCategory,
  canCreateProductionCredential,
} = require("../config/rolePermissions");

const router = express.Router();

// All credential routes require authentication
router.use(verifyToken);

// ──────────────────────────────────────────────
// GET /api/credentials/permissions — Get role-specific permissions
// Returns the categories, access levels, environments, and fields
// for the authenticated user's role
// ──────────────────────────────────────────────
router.get("/permissions", async (req, res) => {
  try {
    const { role } = req.user;
    const permissions = ROLE_PERMISSIONS[role];

    if (!permissions) {
      return res.status(403).json({
        message: "Your role does not have credential vault access.",
      });
    }

    res.status(200).json({
      role,
      permissions: {
        categories: permissions.categories,
        accessLevels: permissions.accessLevels,
        environments: permissions.environments,
        fields: permissions.fields,
        canCreateProduction: permissions.canCreateProduction,
        canManageAllCredentials: permissions.canManageAllCredentials,
        requiresTeamSelection: permissions.requiresTeamSelection,
        requiresProjectSelection: permissions.requiresProjectSelection,
      },
    });
  } catch (error) {
    console.error("Get permissions error:", error);
    res.status(500).json({ message: "Server error while fetching permissions." });
  }
});

// ──────────────────────────────────────────────
// POST /api/credentials — Create a credential
// Enforces role-based category and environment validation
// ──────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { role, userId, teamId: userTeamId } = req.user;
    const {
      credentialName, siteName, username, password,
      websiteUrl, category, environment,
      accessLevel, teamId, project, description,
    } = req.body;

    // Use credentialName or fallback to siteName for backward compat
    const effectiveName = credentialName || siteName;

    if (!effectiveName || !username || !password) {
      return res.status(400).json({
        message: "Credential name, username, and password are required.",
      });
    }

    if (!category) {
      return res.status(400).json({ message: "Category is required." });
    }

    // ═══ RBAC: Validate category is allowed for this role ═══
    if (!canCreateInCategory(role, category)) {
      // Log unauthorized attempt
      await AuditLog.create({
        userId,
        userRole: role,
        action: "UNAUTHORIZED_ATTEMPT",
        details: `Attempted to create credential in restricted category: ${category}`,
        ipAddress: getClientIP(req),
        result: "denied",
      });

      return res.status(403).json({
        message: `Your role (${role}) cannot create credentials in the "${category}" category.`,
        requiresApproval: true,
      });
    }

    // ═══ RBAC: Validate environment restrictions ═══
    if (environment === "production" && !canCreateProductionCredential(role)) {
      await AuditLog.create({
        userId,
        userRole: role,
        action: "UNAUTHORIZED_ATTEMPT",
        details: "Attempted to create production credential without permission",
        ipAddress: getClientIP(req),
        result: "denied",
      });

      return res.status(403).json({
        message: "Production credentials require approval. Please use the access request system.",
        requiresApproval: true,
        requestType: "production_credential",
      });
    }

    // ═══ RBAC: Validate access level is allowed for this role ═══
    if (accessLevel) {
      const allowedLevels = getAllowedAccessLevels(role);
      if (allowedLevels.length > 0 && !allowedLevels.includes(accessLevel)) {
        return res.status(400).json({
          message: `Access level "${accessLevel}" is not available for your role.`,
        });
      }
    }

    // ═══ RBAC: Manager must select team ═══
    const perms = ROLE_PERMISSIONS[role];
    if (perms?.requiresTeamSelection && !teamId && !userTeamId) {
      return res.status(400).json({
        message: "Team selection is required for your role.",
      });
    }

    // Determine which team this credential belongs to
    const user = await User.findById(userId);
    const effectiveTeamId = teamId || user.teamId || null;

    // Only super_admin and admin can add credentials to teams they don't belong to
    if (
      role !== "super_admin" &&
      role !== "admin" &&
      effectiveTeamId &&
      user.teamId?.toString() !== effectiveTeamId.toString()
    ) {
      return res.status(403).json({
        message: "You can only add credentials to your own team.",
      });
    }

    // Encrypt the password before saving
    const encryptedPassword = encrypt(password);

    // Check password against HaveIBeenPwned (k-anonymity)
    const breach = await checkBreach(password);

    const credential = await Credential.create({
      credentialName: effectiveName,
      siteName: effectiveName, // backward compat
      username,
      encryptedPassword,
      websiteUrl: websiteUrl || null,
      category,
      environment: environment || "",
      accessLevel: accessLevel || "private",
      teamId: effectiveTeamId,
      project: project || null,
      description: description || null,
      addedBy: userId,
      addedByRole: role,
      compromised: breach.compromised,
      breachCount: breach.count,
      breachCheckFailed: breach.breachCheckFailed,
    });

    await AuditLog.create({
      userId,
      userRole: role,
      action: "CREATE_CREDENTIAL",
      credentialId: credential._id,
      resource: "credential",
      resourceId: credential._id.toString(),
      details: `Created ${category} credential: ${effectiveName}`,
      ipAddress: getClientIP(req),
      result: "success",
    });

    // Return credential without the encrypted password
    const responseMessage = breach.compromised
      ? `Credential saved, but this password has appeared in ${breach.count.toLocaleString()} data breaches!`
      : breach.breachCheckFailed
      ? "Credential created. Breach check unavailable — status unknown."
      : "Credential created successfully.";

    res.status(201).json({
      message: responseMessage,
      credential: {
        _id: credential._id,
        credentialName: credential.credentialName,
        siteName: credential.siteName,
        username: credential.username,
        websiteUrl: credential.websiteUrl,
        category: credential.category,
        environment: credential.environment,
        accessLevel: credential.accessLevel,
        teamId: credential.teamId,
        project: credential.project,
        description: credential.description,
        addedBy: credential.addedBy,
        addedByRole: credential.addedByRole,
        compromised: credential.compromised,
        breachCount: credential.breachCount,
        breachCheckFailed: credential.breachCheckFailed,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      },
    });
  } catch (error) {
    console.error("Create credential error:", error);
    res.status(500).json({ message: "Server error while creating credential." });
  }
});

// ──────────────────────────────────────────────
// GET /api/credentials — List credentials
// Backend filters credentials based on authenticated user's role
// NEVER returns all credentials to non-admin roles
// ──────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { role, userId, teamId: userTeamId } = req.user;
    let filter = {};

    if (role === "super_admin") {
      // Super admin sees ALL credentials
      filter = {};
    } else if (role === "admin") {
      // Admin sees all except super_admin restricted credentials
      filter = {
        addedByRole: { $ne: "super_admin" },
      };
      // Admin CAN also see their own team's credentials + credentials with
      // company/department access level
      filter = {
        $or: [
          { addedBy: userId },
          { accessLevel: { $in: ["company", "department", "team"] } },
          { addedByRole: { $in: ["admin", "manager", "developer", "employee"] } },
        ],
      };
    } else if (role === "manager") {
      // Manager sees: own credentials + team credentials
      const user = await User.findById(userId);
      if (!user.teamId) {
        filter = { addedBy: userId };
      } else {
        filter = {
          $or: [
            { addedBy: userId },
            { teamId: user.teamId, accessLevel: { $in: ["team_members", "team", "selected_employees"] } },
          ],
        };
      }
    } else if (role === "developer") {
      // Developer sees: own credentials + team credentials shared with them
      const user = await User.findById(userId);
      const allowedCategories = getAllowedCategories("developer");
      if (!user.teamId) {
        filter = { addedBy: userId, category: { $in: allowedCategories } };
      } else {
        filter = {
          $or: [
            { addedBy: userId },
            {
              teamId: user.teamId,
              category: { $in: allowedCategories },
              accessLevel: { $in: ["team", "team_members", "shared_with_team"] },
            },
          ],
        };
      }
    } else {
      // Employee sees: only own credentials + shared team credentials
      const user = await User.findById(userId);
      const allowedCategories = getAllowedCategories("employee");
      if (!user.teamId) {
        filter = { addedBy: userId, category: { $in: allowedCategories } };
      } else {
        filter = {
          $or: [
            { addedBy: userId },
            {
              teamId: user.teamId,
              category: { $in: allowedCategories },
              accessLevel: { $in: ["team", "shared_with_team"] },
            },
          ],
        };
      }
    }

    const credentials = await Credential.find(filter)
      .select("-encryptedPassword") // Never send encrypted blob in list
      .populate("addedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({ credentials });
  } catch (error) {
    console.error("List credentials error:", error);
    res.status(500).json({ message: "Server error while fetching credentials." });
  }
});

// ──────────────────────────────────────────────
// GET /api/credentials/:id — Get single credential
// DECRYPTS the password for the response
// Backend authorizes access per role
// ──────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  // Skip named sub-routes (handled by their own route definitions above/below)
  const reserved = ["permissions", "access-request", "access-requests", "verify-reveal", "verify-update"];
  if (reserved.includes(req.params.id)) return;

  try {
    const { role, userId } = req.user;
    const credential = await Credential.findById(req.params.id)
      .populate("addedBy", "name email role");

    if (!credential) {
      return res.status(404).json({ message: "Credential not found." });
    }

    // ═══ RBAC: Access control ═══
    if (role !== "super_admin") {
      const user = await User.findById(userId);
      const isOwner = credential.addedBy?._id?.toString() === userId ||
        credential.addedBy?.toString() === userId;
      const isSameTeam = user.teamId && credential.teamId &&
        user.teamId.toString() === credential.teamId.toString();

      if (role === "admin") {
        // Admin can't view super_admin's restricted credentials
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

    await AuditLog.create({
      userId,
      userRole: role,
      action: "VIEW_CREDENTIAL",
      credentialId: credential._id,
      resource: "credential",
      resourceId: credential._id.toString(),
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({
      credential: {
        _id: credential._id,
        credentialName: credential.credentialName,
        siteName: credential.siteName,
        username: credential.username,
        password: decryptedPassword, // plaintext only on GET by id
        websiteUrl: credential.websiteUrl,
        category: credential.category,
        environment: credential.environment,
        accessLevel: credential.accessLevel,
        teamId: credential.teamId,
        project: credential.project,
        description: credential.description,
        addedBy: credential.addedBy,
        addedByRole: credential.addedByRole,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get credential error:", error);
    res.status(500).json({ message: "Server error while fetching credential." });
  }
});

// ──────────────────────────────────────────────
// POST /api/credentials/verify-reveal — Verify identity before revealing password
// Supports both OTP-based reveal tokens and legacy Google OAuth tokens
// ──────────────────────────────────────────────
router.post("/verify-reveal", async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { credentialId, verificationToken } = req.body;

    if (!credentialId || !verificationToken) {
      return res.status(400).json({ message: "Credential ID and verification token are required." });
    }

    // Verify the verification token
    try {
      const decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);

      // Ensure the verification token belongs to the same user
      if (decoded.userId !== userId) {
        await AuditLog.create({
          userId,
          userRole: role,
          action: "VERIFICATION_FAILED",
          credentialId,
          details: "Password reveal verification failed - token mismatch",
          ipAddress: getClientIP(req),
          result: "denied",
        });

        return res.status(403).json({ message: "Invalid verification token." });
      }

      // Ensure verification is recent (within 5 minutes)
      if (Date.now() - decoded.timestamp > 5 * 60 * 1000) {
        await AuditLog.create({
          userId,
          userRole: role,
          action: "VERIFICATION_FAILED",
          credentialId,
          details: "Password reveal verification failed - token expired",
          ipAddress: getClientIP(req),
          result: "denied",
        });

        return res.status(403).json({ message: "Verification token expired." });
      }

      // Accept OTP-based reveal tokens (purpose: "password_reveal")
      // OR legacy Google OAuth tokens (with googleId)
      if (decoded.purpose === "password_reveal") {
        // OTP-based token — verify credentialId binding
        if (decoded.credentialId !== credentialId) {
          return res.status(403).json({ message: "Verification token is not valid for this credential." });
        }
      } else if (decoded.googleId) {
        // Legacy Google OAuth token — verify Google account link
        const user = await User.findById(userId);
        if (!user.googleId || !user.googleProvider) {
          return res.status(403).json({ message: "Google account not linked." });
        }
        if (decoded.googleId !== user.googleId) {
          return res.status(403).json({ message: "Google identity verification failed." });
        }
      } else {
        return res.status(403).json({ message: "Invalid verification token type." });
      }

      // Verify user has access to the credential
      const credential = await Credential.findById(credentialId);
      if (!credential) {
        return res.status(404).json({ message: "Credential not found." });
      }

      // RBAC check
      if (role !== "super_admin") {
        const user = await User.findById(userId);
        const isOwner = credential.addedBy.toString() === userId;
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

      // Decrypt and return password
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

      res.status(200).json({
        message: "Password revealed successfully",
        password: decryptedPassword,
      });
    } catch (jwtError) {
      await AuditLog.create({
        userId,
        userRole: role,
        action: "VERIFICATION_FAILED",
        credentialId,
        details: "Password reveal verification failed - invalid token",
        ipAddress: getClientIP(req),
        result: "denied",
      });

      return res.status(403).json({ message: "Invalid verification token." });
    }
  } catch (error) {
    console.error("Verify reveal error:", error);
    res.status(500).json({ message: "Server error during password reveal verification." });
  }
});

// ──────────────────────────────────────────────
// POST /api/credentials/verify-update — Verify identity before updating password
// Supports both OTP-based reveal tokens and legacy Google OAuth tokens
// ──────────────────────────────────────────────
router.post("/verify-update", async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { credentialId, verificationToken, newPassword, confirmPassword } = req.body;

    if (!credentialId || !verificationToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    // Verify the verification token
    try {
      const decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);

      // Ensure the verification token belongs to the same user
      if (decoded.userId !== userId) {
        await AuditLog.create({
          userId,
          userRole: role,
          action: "VERIFICATION_FAILED",
          credentialId,
          details: "Password update verification failed - token mismatch",
          ipAddress: getClientIP(req),
          result: "denied",
        });

        return res.status(403).json({ message: "Invalid verification token." });
      }

      // Ensure verification is recent (within 5 minutes)
      if (Date.now() - decoded.timestamp > 5 * 60 * 1000) {
        await AuditLog.create({
          userId,
          userRole: role,
          action: "VERIFICATION_FAILED",
          credentialId,
          details: "Password update verification failed - token expired",
          ipAddress: getClientIP(req),
          result: "denied",
        });

        return res.status(403).json({ message: "Verification token expired." });
      }

      // Accept OTP-based reveal tokens (purpose: "password_reveal")
      // OR legacy Google OAuth tokens (with googleId)
      if (decoded.purpose === "password_reveal") {
        // OTP-based token — verify credentialId binding
        if (decoded.credentialId !== credentialId) {
          return res.status(403).json({ message: "Verification token is not valid for this credential." });
        }
      } else if (decoded.googleId) {
        // Legacy Google OAuth token — verify Google account link
        const user = await User.findById(userId);
        if (!user.googleId || !user.googleProvider) {
          return res.status(403).json({ message: "Google account not linked." });
        }
        if (decoded.googleId !== user.googleId) {
          return res.status(403).json({ message: "Google identity verification failed." });
        }
      } else {
        return res.status(403).json({ message: "Invalid verification token type." });
      }

      // Find credential and verify access
      const credential = await Credential.findById(credentialId);
      if (!credential) {
        return res.status(404).json({ message: "Credential not found." });
      }

      // RBAC check
      if (role !== "super_admin") {
        const isOwner = credential.addedBy.toString() === userId;

        if (role === "admin") {
          if (credential.addedByRole === "super_admin") {
            return res.status(403).json({ message: "Admin cannot modify Super Admin credentials." });
          }
        } else if (role === "manager") {
          if (["super_admin", "admin"].includes(credential.addedByRole)) {
            return res.status(403).json({ message: "Manager cannot modify Admin or Super Admin credentials." });
          }
          const user = await User.findById(userId);
          const isSameTeam = user.teamId && credential.teamId &&
            user.teamId.toString() === credential.teamId.toString();
          if (!isOwner && !isSameTeam) {
            return res.status(403).json({ message: "Access denied to this credential." });
          }
        } else {
          // Developer / Employee can only edit their own credentials
          if (!isOwner) {
            return res.status(403).json({ message: "You can only edit your own credentials." });
          }
        }
      }

      // Update password
      credential.encryptedPassword = encrypt(newPassword);
      const breach = await checkBreach(newPassword);
      credential.compromised = breach.compromised;
      credential.breachCount = breach.count;
      credential.breachCheckFailed = breach.breachCheckFailed;
      await credential.save();

      // Log successful password update
      await AuditLog.create({
        userId,
        userRole: role,
        action: "PASSWORD_UPDATED",
        credentialId,
        resource: "credential",
        resourceId: credential._id.toString(),
        details: `Password updated for: ${credential.credentialName}`,
        ipAddress: getClientIP(req),
        result: "success",
      });

      const responseMessage = breach.compromised
        ? `Password updated, but it has appeared in ${breach.count.toLocaleString()} data breaches!`
        : breach.breachCheckFailed
        ? "Password updated. Breach check unavailable — status unknown."
        : "Password updated successfully.";

      res.status(200).json({
        message: responseMessage,
        credential: {
          _id: credential._id,
          credentialName: credential.credentialName,
          siteName: credential.siteName,
          username: credential.username,
          websiteUrl: credential.websiteUrl,
          category: credential.category,
          environment: credential.environment,
          accessLevel: credential.accessLevel,
          teamId: credential.teamId,
          project: credential.project,
          description: credential.description,
          addedBy: credential.addedBy,
          addedByRole: credential.addedByRole,
          compromised: credential.compromised,
          breachCount: credential.breachCount,
          breachCheckFailed: credential.breachCheckFailed,
          createdAt: credential.createdAt,
          updatedAt: credential.updatedAt,
        },
      });
    } catch (jwtError) {
      await AuditLog.create({
        userId,
        userRole: role,
        action: "VERIFICATION_FAILED",
        credentialId,
        details: "Password update verification failed - invalid token",
        ipAddress: getClientIP(req),
        result: "denied",
      });

      return res.status(403).json({ message: "Invalid verification token." });
    }
  } catch (error) {
    console.error("Verify update error:", error);
    res.status(500).json({ message: "Server error during password update verification." });
  }
});

// ──────────────────────────────────────────────
// PUT /api/credentials/:id — Update a credential
// ──────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { role, userId } = req.user;
    const credential = await Credential.findById(req.params.id);

    if (!credential) {
      return res.status(404).json({ message: "Credential not found." });
    }

    // ═══ RBAC: Access control ═══
    if (role !== "super_admin") {
      const user = await User.findById(userId);
      const isOwner = credential.addedBy.toString() === userId;

      if (role === "admin") {
        // Admin cannot modify super_admin credentials
        if (credential.addedByRole === "super_admin") {
          return res.status(403).json({
            message: "Admin cannot modify Super Admin credentials.",
          });
        }
      } else if (role === "manager") {
        // Manager cannot modify admin/super_admin credentials
        if (["super_admin", "admin"].includes(credential.addedByRole)) {
          return res.status(403).json({
            message: "Manager cannot modify Admin or Super Admin credentials.",
          });
        }
        // Must be owner or same team
        const isSameTeam = user.teamId && credential.teamId &&
          user.teamId.toString() === credential.teamId.toString();
        if (!isOwner && !isSameTeam) {
          return res.status(403).json({ message: "Access denied to this credential." });
        }
      } else {
        // Developer / Employee can only edit their own credentials
        if (!isOwner) {
          return res.status(403).json({ message: "You can only edit your own credentials." });
        }
      }
    }

    const {
      credentialName, siteName, username, password,
      websiteUrl, category, environment,
      accessLevel, project, description,
    } = req.body;

    const effectiveName = credentialName || siteName;
    if (effectiveName) {
      credential.credentialName = effectiveName;
      credential.siteName = effectiveName;
    }
    if (username) credential.username = username;
    if (websiteUrl !== undefined) credential.websiteUrl = websiteUrl;
    if (category) credential.category = category;
    if (environment !== undefined) credential.environment = environment;
    if (accessLevel) credential.accessLevel = accessLevel;
    if (project !== undefined) credential.project = project;
    if (description !== undefined) credential.description = description;

    // If password changed, re-encrypt and re-check breach status
    if (password) {
      credential.encryptedPassword = encrypt(password);
      const breach = await checkBreach(password);
      credential.compromised = breach.compromised;
      credential.breachCount = breach.count;
      credential.breachCheckFailed = breach.breachCheckFailed;
    }

    await credential.save();

    await AuditLog.create({
      userId,
      userRole: role,
      action: "UPDATE_CREDENTIAL",
      credentialId: credential._id,
      resource: "credential",
      resourceId: credential._id.toString(),
      ipAddress: getClientIP(req),
      result: "success",
    });

    const responseMessage = credential.compromised
      ? `Credential updated, but this password has appeared in ${credential.breachCount.toLocaleString()} data breaches!`
      : credential.breachCheckFailed
      ? "Credential updated. Breach check unavailable — status unknown."
      : "Credential updated successfully.";

    res.status(200).json({
      message: responseMessage,
      credential: {
        _id: credential._id,
        credentialName: credential.credentialName,
        siteName: credential.siteName,
        username: credential.username,
        websiteUrl: credential.websiteUrl,
        category: credential.category,
        environment: credential.environment,
        accessLevel: credential.accessLevel,
        teamId: credential.teamId,
        project: credential.project,
        description: credential.description,
        addedBy: credential.addedBy,
        addedByRole: credential.addedByRole,
        compromised: credential.compromised,
        breachCount: credential.breachCount,
        breachCheckFailed: credential.breachCheckFailed,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update credential error:", error);
    res.status(500).json({ message: "Server error while updating credential." });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/credentials/:id — Delete a credential
// super_admin: any | admin: non-super_admin | manager: own team
// ──────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const { role, userId } = req.user;
    const credential = await Credential.findById(req.params.id);

    if (!credential) {
      return res.status(404).json({ message: "Credential not found." });
    }

    // ═══ RBAC: Delete authorization ═══
    if (role === "super_admin") {
      // Can delete anything
    } else if (role === "admin") {
      if (credential.addedByRole === "super_admin") {
        return res.status(403).json({
          message: "Admin cannot delete Super Admin credentials.",
        });
      }
    } else if (role === "manager") {
      // Can delete own or team credentials (not admin/super_admin)
      const isOwner = credential.addedBy.toString() === userId;
      if (["super_admin", "admin"].includes(credential.addedByRole)) {
        return res.status(403).json({
          message: "Manager cannot delete Admin or Super Admin credentials.",
        });
      }
      const user = await User.findById(userId);
      const isSameTeam = user.teamId && credential.teamId &&
        user.teamId.toString() === credential.teamId.toString();
      if (!isOwner && !isSameTeam) {
        return res.status(403).json({ message: "Access denied." });
      }
    } else {
      // Developer / Employee can only delete own credentials
      const isOwner = credential.addedBy.toString() === userId;
      if (!isOwner) {
        return res.status(403).json({ message: "You can only delete your own credentials." });
      }
    }

    await Credential.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      userId,
      userRole: role,
      action: "DELETE_CREDENTIAL",
      credentialId: credential._id,
      resource: "credential",
      resourceId: credential._id.toString(),
      details: `Deleted credential: ${credential.credentialName}`,
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({ message: "Credential deleted successfully." });
  } catch (error) {
    console.error("Delete credential error:", error);
    res.status(500).json({ message: "Server error while deleting credential." });
  }
});

// ──────────────────────────────────────────────
// POST /api/credentials/access-request — Request access
// For developers requesting production access,
// or employees requesting restricted resources
// ──────────────────────────────────────────────
router.post("/access-request", async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { requestType, category, reason, resourceName } = req.body;

    if (!requestType || !category || !reason || !resourceName) {
      return res.status(400).json({
        message: "Request type, category, reason, and resource name are required.",
      });
    }

    const accessRequest = await AccessRequest.create({
      requesterId: userId,
      requestType,
      category,
      reason,
      resourceName,
    });

    await AuditLog.create({
      userId,
      userRole: role,
      action: "ACCESS_REQUESTED",
      resource: "access_request",
      resourceId: accessRequest._id.toString(),
      details: `Requested ${requestType} access for: ${resourceName} (${category})`,
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(201).json({
      message: "Access request submitted successfully. An administrator will review your request.",
      accessRequest: {
        _id: accessRequest._id,
        requestType: accessRequest.requestType,
        category: accessRequest.category,
        resourceName: accessRequest.resourceName,
        status: accessRequest.status,
        createdAt: accessRequest.createdAt,
      },
    });
  } catch (error) {
    console.error("Access request error:", error);
    res.status(500).json({ message: "Server error while submitting access request." });
  }
});

// ──────────────────────────────────────────────
// GET /api/credentials/access-requests — List access requests
// Admin/Super Admin see all, others see their own
// ──────────────────────────────────────────────
router.get("/access-requests", async (req, res) => {
  try {
    const { role, userId } = req.user;
    let filter = {};

    if (role !== "super_admin" && role !== "admin") {
      filter.requesterId = userId;
    }

    const requests = await AccessRequest.find(filter)
      .populate("requesterId", "name email role")
      .populate("reviewedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({ accessRequests: requests });
  } catch (error) {
    console.error("List access requests error:", error);
    res.status(500).json({ message: "Server error while fetching access requests." });
  }
});

// ──────────────────────────────────────────────
// PUT /api/credentials/access-requests/:id — Approve/reject
// Admin and Super Admin only
// ──────────────────────────────────────────────
router.put("/access-requests/:id", authorizeRole("super_admin", "admin"), async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { status, reviewNote, expiresInHours } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'." });
    }

    const request = await AccessRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Access request not found." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "This request has already been reviewed." });
    }

    request.status = status;
    request.reviewedBy = userId;
    request.reviewedAt = new Date();
    request.reviewNote = reviewNote || null;

    if (status === "approved" && expiresInHours) {
      request.expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    }

    await request.save();

    const action = status === "approved" ? "ACCESS_APPROVED" : "ACCESS_REJECTED";
    await AuditLog.create({
      userId,
      userRole: role,
      action,
      targetUserId: request.requesterId,
      resource: "access_request",
      resourceId: request._id.toString(),
      details: `${status} access request for: ${request.resourceName}`,
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({
      message: `Access request ${status}.`,
      accessRequest: request,
    });
  } catch (error) {
    console.error("Review access request error:", error);
    res.status(500).json({ message: "Server error while reviewing access request." });
  }
});

module.exports = router;
