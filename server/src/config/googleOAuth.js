const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { AuditLog } = require("../models");

// Helper: Get client IP address from request
const getClientIP = (req) => {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown";
};

// Configure Google OAuth Strategy only if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback",
        passReqToCallback: true, // Pass request to callback for state validation
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          // Verify the state parameter to ensure OAuth flow integrity
          const state = req.query.state;
          if (!state) {
            return done(null, false, { message: "Missing state parameter" });
          }

          let decodedState;
          try {
            decodedState = jwt.verify(state, process.env.JWT_SECRET);
          } catch (stateError) {
            return done(null, false, { message: "Invalid state parameter" });
          }

          // Ensure state was for identity verification
          if (decodedState.purpose !== "identity_verification") {
            return done(null, false, { message: "Invalid state purpose" });
          }

          // Store the return URL in the request for later use
          req.returnUrl = decodedState.returnUrl || "/dashboard";

          // Ensure state is recent (within 10 minutes)
          if (Date.now() - decodedState.timestamp > 10 * 60 * 1000) {
            return done(null, false, { message: "State parameter expired" });
          }

          // Find the user who initiated the OAuth flow
          const initiatingUser = await User.findById(decodedState.userId);
          if (!initiatingUser) {
            return done(null, false, { message: "User not found" });
          }

          // Check if the user already has this Google account linked
          if (initiatingUser.googleId && initiatingUser.googleId !== profile.id) {
            return done(null, false, { message: "User already has a different Google account linked" });
          }

          // Check if this Google account is already linked to another user
          const existingGoogleUser = await User.findOne({ googleId: profile.id });
          if (existingGoogleUser && existingGoogleUser._id.toString() !== initiatingUser._id.toString()) {
            return done(null, false, { message: "Google account already linked to another user" });
          }

          // Check if the Google email matches the user's email (optional security check)
          // This ensures the Google account belongs to the same person
          if (initiatingUser.email.toLowerCase() !== profile.emails[0].value.toLowerCase()) {
            return done(null, false, { message: "Google email does not match your account email" });
          }

          // Link Google account to the user
          initiatingUser.googleId = profile.id;
          initiatingUser.googleEmail = profile.emails[0].value;
          initiatingUser.googleAccessToken = accessToken;
          initiatingUser.googleRefreshToken = refreshToken;
          initiatingUser.googleProvider = "google";
          await initiatingUser.save();

          // Log successful Google account linking
          await AuditLog.create({
            userId: initiatingUser._id,
            userRole: initiatingUser.role,
            action: "GOOGLE_ACCOUNT_LINKED",
            details: `Google account linked: ${profile.emails[0].value}`,
            ipAddress: getClientIP(req),
            result: "success",
          });

          return done(null, initiatingUser);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
