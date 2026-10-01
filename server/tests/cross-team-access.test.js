/**
 * Cross-team access control test for GET /api/credentials/:id
 * 
 * Run with the server already up: node tests/cross-team-access.test.js
 */

const http = require("http");
const mongoose = require("mongoose");

const BASE = "http://localhost:5000";

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

async function run() {
  console.log("\n🔒 Cross-Team Access Control Test\n" + "─".repeat(50));

  // Verify server is up
  const health = await request("GET", "/api/health");
  assert(health.status === 200 && health.body.status === "ok", `Server healthy (${health.body.status})`);

  // ── 1. Register users ──
  console.log("\n1️⃣  Registering users...\n");

  const adminReg = await request("POST", "/api/auth/register", {
    name: "Admin User", email: "admin@test.com", password: "admin123",
  });
  assert(adminReg.status === 201, `Admin registered (${adminReg.status})`);
  const adminId = adminReg.body.user.id;

  const empAReg = await request("POST", "/api/auth/register", {
    name: "Employee A", email: "empA@test.com", password: "empA1234",
  });
  assert(empAReg.status === 201, `Employee A registered (${empAReg.status})`);
  const empAId = empAReg.body.user.id;

  const empBReg = await request("POST", "/api/auth/register", {
    name: "Employee B", email: "empB@test.com", password: "empB1234",
  });
  assert(empBReg.status === 201, `Employee B registered (${empBReg.status})`);
  const empBId = empBReg.body.user.id;

  // ── 2. Promote admin via direct DB ──
  console.log("\n2️⃣  Promoting admin role via DB...\n");

  // Decode JWT to find the MongoDB URI from the server's in-memory instance
  // We'll connect to the same DB the server uses
  const User = require("../src/models/User");

  // Try the in-memory URI printed in server logs, or default
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/company-password-vault";
  try {
    await mongoose.connect(mongoUri);
    await User.findByIdAndUpdate(adminId, { role: "admin" });
    console.log("  ✅ Admin promoted to role: admin");
  } catch (e) {
    console.log("  ⚠️  Could not connect to DB for role promotion:", e.message);
    console.log("  Skipping test — set MONGO_URI env var to the in-memory URI shown in server logs.");
    process.exit(1);
  }

  // Re-login to get fresh tokens with updated roles/teams
  const adminLogin = await request("POST", "/api/auth/login", {
    email: "admin@test.com", password: "admin123",
  });
  const adminToken = adminLogin.body.token;
  assert(adminLogin.body.user.role === "admin", `Admin role: ${adminLogin.body.user.role}`);

  // ── 3. Create teams and assign ──
  console.log("\n3️⃣  Creating teams and assigning members...\n");

  const teamA = await request("POST", "/api/teams", { name: "Team Alpha" }, adminToken);
  assert(teamA.status === 201, `Team Alpha created`);
  const teamAId = teamA.body.team._id;

  const teamB = await request("POST", "/api/teams", { name: "Team Beta" }, adminToken);
  assert(teamB.status === 201, `Team Beta created`);
  const teamBId = teamB.body.team._id;

  const assignA = await request("POST", `/api/teams/${teamAId}/members`, { userId: empAId }, adminToken);
  assert(assignA.status === 200, `Employee A → Team Alpha`);

  const assignB = await request("POST", `/api/teams/${teamBId}/members`, { userId: empBId }, adminToken);
  assert(assignB.status === 200, `Employee B → Team Beta`);

  // Re-login employees to get tokens reflecting their teamId
  const empALogin = await request("POST", "/api/auth/login", { email: "empA@test.com", password: "empA1234" });
  const empAToken = empALogin.body.token;

  const empBLogin = await request("POST", "/api/auth/login", { email: "empB@test.com", password: "empB1234" });
  const empBToken = empBLogin.body.token;

  // ── 4. Employee A creates a credential ──
  console.log("\n4️⃣  Employee A creates a credential on Team Alpha...\n");

  const credCreate = await request("POST", "/api/credentials", {
    siteName: "Secret AWS Console",
    username: "aws-admin@company.com",
    password: "SuperSecret!@#$%^",
  }, empAToken);
  assert(credCreate.status === 201, `Credential created`);
  const credId = credCreate.body.credential._id;
  console.log(`  Credential ID: ${credId}`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. THE CRITICAL TEST
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n5️⃣  🔥 CRITICAL: Employee B (Team Beta) tries to decrypt Team Alpha's credential...\n");

  const crossTeam = await request("GET", `/api/credentials/${credId}`, null, empBToken);

  assert(crossTeam.status === 403, `Status: ${crossTeam.status} (expected 403)`);
  assert(!crossTeam.body.credential, `No credential data leaked`);
  assert(!crossTeam.body.password, `No password field in response`);
  console.log(`  Response body: ${JSON.stringify(crossTeam.body)}`);

  // ── 6. Employee A CAN access own credential ──
  console.log("\n6️⃣  Employee A (Team Alpha) accesses their OWN credential...\n");

  const sameTeam = await request("GET", `/api/credentials/${credId}`, null, empAToken);

  assert(sameTeam.status === 200, `Status: ${sameTeam.status} (expected 200)`);
  assert(sameTeam.body.credential?.password === "SuperSecret!@#$%^",
    `Decrypted password: "${sameTeam.body.credential?.password}"`);

  // ── 7. Admin CAN access any credential ──
  console.log("\n7️⃣  Admin accesses Team Alpha's credential...\n");

  const adminGet = await request("GET", `/api/credentials/${credId}`, null, adminToken);

  assert(adminGet.status === 200, `Status: ${adminGet.status} (expected 200)`);
  assert(adminGet.body.credential?.password === "SuperSecret!@#$%^",
    `Admin decrypted: "${adminGet.body.credential?.password}"`);

  // ── 8. Employee B list should be empty ──
  console.log("\n8️⃣  Employee B lists credentials (should see 0)...\n");

  const empBList = await request("GET", "/api/credentials", null, empBToken);
  assert(empBList.status === 200, `List status: ${empBList.status}`);
  assert(empBList.body.credentials.length === 0, `Sees ${empBList.body.credentials.length} credentials (expected 0)`);

  // ── Summary ──
  console.log("\n" + "═".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(failed === 0 ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED");
  console.log("═".repeat(50) + "\n");

  await mongoose.connection.db.dropDatabase();
  console.log("🧹 Test database cleaned.\n");
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
