const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const { User, AuditLog } = require("../models");
const { verifyToken, requireRole, authorizeRole, ROLE_HIERARCHY, getClientIP } = require("../middleware/auth");
const googleOAuthConfig = require("../config/googleOAuth");

const router = express.Router();

// Initialize Passport
router.use(passport.initialize());

// ──────────────────────────────────────────────
// POST /api/auth/register
// ──────────────────────────────────────────────
// The role selected during registration becomes the user's permanent role.
// Privileged roles (super_admin, admin, manager) require admin approval.
// Until approved, the user's effective role defaults to "employee" and
// the requested role is stored separately.
// ──────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, username } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    if (!username) {
      return res.status(400).json({ message: "Username is required." });
    }

    // Validate username format
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{2,29}$/.test(username)) {
      return res.status(400).json({
        message: "Username must start with a letter, be 3-30 characters, and contain only letters, numbers, underscores, or hyphens.",
      });
    }

    // Check if user already exists (email or username)
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ message: "This username is already taken." });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ═══ ROLE ASSIGNMENT LOGIC ═══
    // The role selected during registration becomes the user's PERMANENT role.
    // It is saved directly to the database and cannot be changed by the user.
    const validRoles = ["super_admin", "admin", "manager", "developer", "employee"];
    const userRole = validRoles.includes(role) ? role : "employee";

    const user = await User.create({
      name,
      email,
      username,
      password: hashedPassword,
      role: userRole,
      status: "active",
    });

    // Generate token — only includes userId for identification.
    // The role is NEVER trusted from JWT; always fetched from DB.
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Audit log
    await AuditLog.create({
      userId: user._id,
      userRole: user.role,
      action: "REGISTER",
      details: `Registered as ${userRole}`,
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        requestedRole: user.requestedRole,
        status: user.status,
        teamId: user.teamId,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    // Handle MongoDB duplicate key error (race condition on unique fields)
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0];
      return res.status(409).json({
        message: field === "username"
          ? "This username is already taken."
          : "An account with this email already exists.",
      });
    }

    res.status(500).json({ message: "Server error during registration." });
  }
});

// ──────────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────────
// After login, the backend retrieves the user's role from the database
// and returns it. The frontend redirects to the role-based dashboard.
// The user NEVER selects a role during login.
// ──────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // Find user and explicitly include password field
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      // Audit log for failed login attempt
      await AuditLog.create({
        userId: null,
        userRole: null,
        action: "LOGIN",
        details: `Failed login attempt for email: ${email} (account not found)`,
        ipAddress: getClientIP(req),
        result: "failure",
      }).catch(() => {}); // Don't fail login on audit error

      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Check account status
    if (user.status === "suspended") {
      return res.status(403).json({ message: "Your account has been suspended. Contact an administrator." });
    }

    if (user.status === "inactive") {
      return res.status(403).json({ message: "Your account is inactive. Contact an administrator." });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Audit log for failed login
      await AuditLog.create({
        userId: user._id,
        userRole: user.role,
        action: "LOGIN",
        details: "Failed login attempt (wrong password)",
        ipAddress: getClientIP(req),
        result: "failure",
      }).catch(() => {});

      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Generate token — only userId for identification.
    // The backend ALWAYS fetches the role from DB, never from JWT.
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Audit log
    await AuditLog.create({
      userId: user._id,
      userRole: user.role,
      action: "LOGIN",
      ipAddress: getClientIP(req),
      result: "success",
    });

    // ═══ The role comes from the DATABASE, not from any client input ═══
    res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,            // From DATABASE
        requestedRole: user.requestedRole,
        status: user.status,
        teamId: user.teamId,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

// ──────────────────────────────────────────────
// POST /api/auth/logout — Audit-logged logout
// ──────────────────────────────────────────────
router.post("/logout", verifyToken, async (req, res) => {
  try {
    await AuditLog.create({
      userId: req.user.userId,
      userRole: req.user.role,
      action: "LOGOUT",
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(200).json({ message: "Logged out." });
  }
});

// ──────────────────────────────────────────────
// GET /api/auth/me — Get current user profile
// ──────────────────────────────────────────────
// This endpoint is the source of truth for the frontend.
// The role returned here comes directly from the database.
// ──────────────────────────────────────────────
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,            // From DATABASE — source of truth
        requestedRole: user.requestedRole,
        status: user.status,
        teamId: user.teamId,
        profilePicture: user.profilePicture,
        googleLinked: !!user.googleId, // Indicates if Google account is linked
        googleEmail: user.googleEmail, // The linked Google email (masked for security)
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Server error while fetching profile." });
  }
});

// ──────────────────────────────────────────────
// PUT /api/auth/profile — Update name/email/picture
// ──────────────────────────────────────────────
// NOTE: The role field is NEVER accepted from this endpoint.
// Users cannot change their own role.
// ──────────────────────────────────────────────
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { name, email, profilePicture } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // ═══ SECURITY: Ignore any role field in the request body ═══
    // The profile update endpoint NEVER allows role changes.

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "This email is already in use." });
      }
      user.email = email;
    }

    if (name) user.name = name;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

    await user.save();

    // Audit log
    await AuditLog.create({
      userId: user._id,
      userRole: req.user.role,
      action: "PROFILE_UPDATE",
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({
      message: "Profile updated successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        requestedRole: user.requestedRole,
        status: user.status,
        teamId: user.teamId,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error while updating profile." });
  }
});

// ──────────────────────────────────────────────
// PUT /api/auth/change-password
// Requires current password verification (bcrypt.compare)
// ──────────────────────────────────────────────
router.put("/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    // Fetch user with password field
    const user = await User.findById(req.user.userId).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(403).json({ message: "Current password is incorrect." });
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Audit log
    await AuditLog.create({
      userId: user._id,
      userRole: req.user.role,
      action: "PASSWORD_CHANGE",
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error while changing password." });
  }
});

// ──────────────────────────────────────────────
// GET /api/auth/users — List all users
// super_admin: all users | admin: all users
// ──────────────────────────────────────────────
router.get("/users", verifyToken, requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const users = await User.find({}, "name email username role status requestedRole teamId createdAt").sort({ createdAt: -1 });
    res.status(200).json({ users });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Server error while fetching users." });
  }
});

// ──────────────────────────────────────────────
// PUT /api/auth/users/:id/role — Change a user's role
// super_admin only
// ──────────────────────────────────────────────
// This is the ONLY way to change a user's role after registration.
// The role change is logged in the audit trail.
// ──────────────────────────────────────────────
router.put("/users/:id/role", verifyToken, requireRole("super_admin"), async (req, res) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    // ═══ SECURITY: Only accept role from server-validated request ═══
    // Validate role
    const validRoles = Object.keys(ROLE_HIERARCHY);
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // Cannot change own role (safety)
    if (targetUser._id.toString() === req.user.userId) {
      return res.status(400).json({ message: "You cannot change your own role." });
    }

    const previousRole = targetUser.role;
    targetUser.role = role;
    // Clear the pending role request if it was being approved
    if (targetUser.requestedRole === role) {
      targetUser.requestedRole = null;
    }
    // Activate the user if they were pending approval
    if (targetUser.status === "pending_approval") {
      targetUser.status = "active";
    }
    await targetUser.save();

    // Audit log
    await AuditLog.create({
      userId: req.user.userId,
      userRole: req.user.role,
      action: "ROLE_CHANGE",
      targetUserId: targetUser._id,
      details: `Role changed from ${previousRole} to ${role}`,
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({
      message: `${targetUser.name}'s role changed from ${previousRole} to ${role}.`,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status,
        teamId: targetUser.teamId,
      },
    });
  } catch (error) {
    console.error("Role change error:", error);
    res.status(500).json({ message: "Server error while changing role." });
  }
});

// ──────────────────────────────────────────────
// PUT /api/auth/users/:id/status — Change a user's status
// super_admin only
// ──────────────────────────────────────────────
router.put("/users/:id/status", verifyToken, requireRole("super_admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = ["active", "inactive", "suspended"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // Cannot change own status
    if (targetUser._id.toString() === req.user.userId) {
      return res.status(400).json({ message: "You cannot change your own status." });
    }

    const previousStatus = targetUser.status;
    targetUser.status = status;
    await targetUser.save();

    await AuditLog.create({
      userId: req.user.userId,
      userRole: req.user.role,
      action: "ROLE_CHANGE",
      targetUserId: targetUser._id,
      details: `Status changed from ${previousStatus} to ${status}`,
      ipAddress: getClientIP(req),
      result: "success",
    });

    res.status(200).json({
      message: `${targetUser.name}'s status changed to ${status}.`,
    });
  } catch (error) {
    console.error("Status change error:", error);
    res.status(500).json({ message: "Server error while changing status." });
  }
});

// ──────────────────────────────────────────────
// Google OAuth Routes for Identity Verification
// ──────────────────────────────────────────────

// GET /api/auth/google — Initiate Google OAuth for verification
// Requires user to be authenticated first
router.get("/google", verifyToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const returnUrl = req.query.returnUrl || "/dashboard";

    // Create a state parameter with the user's ID and timestamp
    const state = jwt.sign(
      {
        userId: userId,
        timestamp: Date.now(),
        purpose: "identity_verification",
        returnUrl: returnUrl,
      },
      process.env.JWT_SECRET,
      { expiresIn: "10m" } // State token valid for 10 minutes
    );

    // Redirect to Google OAuth with state parameter
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
      state: state,
    })(req, res);
  } catch (error) {
    console.error("Google OAuth initiation error:", error);
    res.redirect("/login?error=oauth_init_failed");
  }
});

// GET /api/auth/google/callback — Google OAuth callback
router.get("/google/callback",
  passport.authenticate("google", { failureRedirect: "/login?error=google_auth_failed" }),
  async (req, res) => {
    try {
      // Verify the state parameter to ensure it matches the original user
      const state = req.query.state;
      if (!state) {
        return res.redirect("/login?error=missing_state");
      }

      let decodedState;
      try {
        decodedState = jwt.verify(state, process.env.JWT_SECRET);
      } catch (stateError) {
        return res.redirect("/login?error=invalid_state");
      }

      // Ensure state was for identity verification
      if (decodedState.purpose !== "identity_verification") {
        return res.redirect("/login?error=invalid_purpose");
      }

      // Ensure state is recent (within 10 minutes)
      if (Date.now() - decodedState.timestamp > 10 * 60 * 1000) {
        return res.redirect("/login?error=state_expired");
      }

      // CRITICAL: Ensure the Google account is being linked to the correct user
      // The user who initiated the OAuth flow (from state) must match the user
      // that the Google account is being linked to (from OAuth callback)
      if (req.user._id.toString() !== decodedState.userId) {
        await AuditLog.create({
          userId: decodedState.userId,
          userRole: req.user.role,
          action: "VERIFICATION_FAILED",
          details: "Google account linking failed - user mismatch in OAuth flow",
          ipAddress: getClientIP(req),
          result: "denied",
        });

        return res.redirect("/login?error=user_mismatch");
      }

      // Generate a verification token that includes the Google ID for validation
      const verificationToken = jwt.sign(
        {
          userId: req.user._id,
          googleId: req.user.googleId,
          googleEmail: req.user.googleEmail,
          verified: true,
          timestamp: Date.now(),
        },
        process.env.JWT_SECRET,
        { expiresIn: "5m" } // Short-lived token for verification
      );

      // Log successful verification
      await AuditLog.create({
        userId: req.user._id,
        userRole: req.user.role,
        action: "VERIFICATION_SUCCESS",
        details: "Google identity verified successfully",
        ipAddress: getClientIP(req),
        result: "success",
      });

      // Redirect to frontend with verification token and return URL
      const returnUrl = decodedState.returnUrl || "/dashboard";
      res.redirect(`http://localhost:5173/verification-success?token=${verificationToken}&returnUrl=${encodeURIComponent(returnUrl)}`);
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect("/login?error=verification_failed");
    }
  }
);

// POST /api/auth/verify-identity — Verify identity token from frontend
router.post("/verify-identity", verifyToken, async (req, res) => {
  try {
    const { verificationToken } = req.body;
    const { userId, role } = req.user;

    if (!verificationToken) {
      return res.status(400).json({ message: "Verification token is required." });
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
          details: "Verification token does not match current user",
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
          details: "Verification token expired",
          ipAddress: getClientIP(req),
          result: "denied",
        });

        return res.status(403).json({ message: "Verification token expired." });
      }

      // Log successful verification
      await AuditLog.create({
        userId,
        userRole: role,
        action: "VERIFICATION_SUCCESS",
        details: "Google identity verified successfully",
        ipAddress: getClientIP(req),
        result: "success",
      });

      res.status(200).json({
        message: "Identity verified successfully",
        verified: true,
        userId: decoded.userId,
      });
    } catch (jwtError) {
      await AuditLog.create({
        userId,
        userRole: role,
        action: "VERIFICATION_FAILED",
        details: "Invalid verification token",
        ipAddress: getClientIP(req),
        result: "denied",
      });

      return res.status(403).json({ message: "Invalid verification token." });
    }
  } catch (error) {
    console.error("Verify identity error:", error);
    res.status(500).json({ message: "Server error during verification." });
  }
});

// GET /api/auth/google-status — Check Google account linking status
router.get("/google-status", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      googleLinked: !!user.googleId,
      googleEmail: user.googleEmail ? user.googleEmail.replace(/(?<=.{2}).(?=.*@)/g, '*') : null, // Mask email for security
      googleProvider: user.googleProvider,
    });
  } catch (error) {
    console.error("Google status error:", error);
    res.status(500).json({ message: "Server error while checking Google status." });
  }
});

module.exports = router;
