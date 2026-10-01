const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const healthRoute = require("./routes/health");
const authRoute = require("./routes/auth");
const teamRoute = require("./routes/team");
const credentialRoute = require("./routes/credential");
const auditLogRoute = require("./routes/auditLog");
const dashboardRoute = require("./routes/dashboard");
const verifyRoute = require("./routes/verify");
const passwordRevealRoute = require("./routes/passwordReveal");
const bcrypt = require("bcryptjs");
const { User, Team, Credential, AuditLog, AccessRequest } = require("./models");

// Load environment variables
dotenv.config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 5000;

// --------------- Middleware ---------------
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"], credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());

// --------------- Routes ---------------
app.use("/api/health", healthRoute);
app.use("/api/auth", authRoute);
app.use("/api/teams", teamRoute);
app.use("/api/credentials", credentialRoute);
app.use("/api/audit-logs", auditLogRoute);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/verify", verifyRoute);
app.use("/api/auth/password-reveal", passwordRevealRoute);

// --------------- Start server ---------------
const startServer = async () => {
  await connectDB();

  // Ensure all collections exist in MongoDB (visible in Compass/Atlas)
  await Promise.all([
    User.createCollection(),
    Team.createCollection(),
    Credential.createCollection(),
    AuditLog.createCollection(),
    AccessRequest.createCollection(),
  ]);
  console.log("📦 Collections initialized: users, teams, credentials, auditlogs, accessrequests");

  // Auto-seed a super_admin account in in-memory mode (for dev/testing)
  const seedEmail = process.env.SEED_ADMIN_EMAIL || "admin@testvault.com";
  const seedPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const existingAdmin = await User.findOne({ email: seedEmail });
  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(seedPassword, salt);
    await User.create({
      name: "Super Admin",
      username: "super_admin",
      email: seedEmail,
      password: hashedPassword,
      role: "super_admin",
      status: "active",
    });
    console.log(`🌱 Seeded super_admin: ${seedEmail}`);
  } else {
    console.log(`ℹ️  Admin account exists: ${seedEmail} (role: ${existingAdmin.role})`);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Port ${PORT} is already in use by another process.`);
      console.error(`   Run: netstat -ano | findstr :${PORT}  to find the conflicting PID.`);
      console.error(`   Then: taskkill /PID <pid> /F  to free the port.\n`);
    } else {
      console.error("❌ Server error:", err.message);
    }
    process.exit(1);
  });
};

startServer();

module.exports = app;
