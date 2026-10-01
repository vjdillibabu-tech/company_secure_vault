const mongoose = require("mongoose");
const dns = require("dns");
const fs = require("fs");
const path = require("path");

// Force Google DNS to resolve mongodb+srv:// SRV records
// (user's ISP DNS cannot resolve Atlas SRV records)
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// File where the active MongoDB URI is written so seed scripts can find it
const URI_FILE = path.join(__dirname, "..", ".active-mongo-uri");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("❌ MONGO_URI is not defined in environment variables.");
    console.error("   Please set MONGO_URI in your .env file.");
    console.error("   Example: MONGO_URI=mongodb://localhost:27017/company-password-vault");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // 10s for Atlas latency
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    // Write the active URI so seed scripts can find it
    fs.writeFileSync(URI_FILE, uri);
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    console.error("");
    console.error("To fix this issue:");
    console.error("1. If using local MongoDB: Ensure MongoDB is running on the specified host/port");
    console.error("2. If using MongoDB Atlas: Check your MONGO_URI credentials in .env file");
    console.error("3. Ensure your IP is whitelisted in MongoDB Atlas if using cloud database");
    console.error("");
    console.error(`Current MONGO_URI: ${uri}`);
    process.exit(1);
  }
};

module.exports = connectDB;
