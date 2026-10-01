const mongoose = require("mongoose");
const dns = require("dns");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Force Google DNS for Atlas SRV resolution
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Load environment variables from the project root .env
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });

const User = require("../models/User");

const URI_FILE = path.join(__dirname, "..", ".active-mongo-uri");

// Target role from command line argument (default: super_admin)
const TARGET_ROLE = process.argv[2] || "super_admin";
const TARGET_EMAIL = process.argv[3] || "admin@testvault.com";

const VALID_ROLES = ["super_admin", "admin", "manager", "developer", "employee"];

async function seedAdmin() {
  // Validate target role
  if (!VALID_ROLES.includes(TARGET_ROLE)) {
    console.error(`❌ Invalid role: ${TARGET_ROLE}`);
    console.error(`   Valid roles: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  // 1. Try the URI written by the running server (works for in-memory, Atlas, or local)
  // 2. Fall back to MONGO_URI from .env (works when external DB is reachable)
  let uri;
  let source;

  if (fs.existsSync(URI_FILE)) {
    uri = fs.readFileSync(URI_FILE, "utf-8").trim();
    source = ".active-mongo-uri (written by the running server)";
  } else {
    uri = process.env.MONGO_URI;
    source = "MONGO_URI from .env";
  }

  if (!uri) {
    console.error("❌ No MongoDB URI available.");
    console.error("   Either start the server first (creates .active-mongo-uri),");
    console.error("   or set MONGO_URI in .env to a reachable MongoDB instance.");
    process.exit(1);
  }

  console.log(`📄 Using URI from: ${source}`);
  console.log(`🎯 Target: ${TARGET_EMAIL} → role: ${TARGET_ROLE}`);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("✅ Connected to MongoDB");

    const user = await User.findOne({ email: TARGET_EMAIL });

    if (!user) {
      console.log(`\n❌ No user found with email: ${TARGET_EMAIL}`);
      console.log("   Please register an account with that email first, then re-run this script.");
      console.log("\n   Usage: node seed-admin.js [role] [email]");
      console.log("   Example: node seed-admin.js super_admin admin@testvault.com");
      process.exit(1);
    }

    if (user.role === TARGET_ROLE) {
      console.log(`\nℹ️  User already has role: ${TARGET_ROLE}`);
    } else {
      const previousRole = user.role;
      user.role = TARGET_ROLE;
      await user.save();
      console.log(`\n✅ ${TARGET_EMAIL}: ${previousRole} → ${TARGET_ROLE}`);
    }

    // Print the full user document for confirmation
    console.log("\n── User Document ──────────────────────────────");
    console.log(JSON.stringify(user.toObject(), null, 2));
    console.log("───────────────────────────────────────────────\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

seedAdmin();
