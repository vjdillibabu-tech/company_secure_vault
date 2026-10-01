/**
 * Audit Log Integration Test
 *
 * Tests:
 *   1. Non-admin gets 403 on GET /api/audit-logs (role enforcement)
 *   2. Admin can access audit logs
 *   3. Logs contain the actions we performed earlier in the test
 *   4. userId filter narrows results correctly
 *   5. action filter narrows results correctly
 *   6. Combined filters work
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
  console.log("\n📋 Audit Log Integration Test\n" + "─".repeat(50));

  // Connect to the same in-memory DB as the server
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log("❌ Set MONGO_URI to the in-memory URI from server logs.");
    process.exit(1);
  }

  const User = require("../src/models/User");
  await mongoose.connect(mongoUri);

  // ── 1. Setup: Register users and generate audit events ──
  console.log("\n1️⃣  Setting up users and generating events...\n");

  const adminReg = await request("POST", "/api/auth/register", {
    name: "Audit Admin", email: "audit-admin@test.com", password: "admin123",
  });
  assert(adminReg.status === 201, `Admin registered (${adminReg.status})`);
  const adminId = adminReg.body.user.id;

  const empReg = await request("POST", "/api/auth/register", {
    name: "Audit Employee", email: "audit-emp@test.com", password: "emp12345",
  });
  assert(empReg.status === 201, `Employee registered (${empReg.status})`);
  const empId = empReg.body.user.id;

  // Promote admin
  await User.findByIdAndUpdate(adminId, { role: "admin" });
  console.log("  ✅ Admin promoted via DB");

  // Re-login both
  const adminLogin = await request("POST", "/api/auth/login", {
    email: "audit-admin@test.com", password: "admin123",
  });
  if (adminLogin.status !== 200) {
    console.log("  ⚠️  Admin login response:", JSON.stringify(adminLogin.body));
  }
  const adminToken = adminLogin.body.token;
  assert(adminLogin.body.user?.role === "admin", `Admin role: ${adminLogin.body.user?.role}`);

  const empLogin = await request("POST", "/api/auth/login", {
    email: "audit-emp@test.com", password: "emp12345",
  });
  const empToken = empLogin.body.token;

  // Create a team and assign employee so they can create credentials
  const teamRes = await request("POST", "/api/teams", { name: "Audit Team" }, adminToken);
  const teamId = teamRes.body.team._id;
  await request("POST", `/api/teams/${teamId}/members`, { userId: empId }, adminToken);

  // Re-login employee to get fresh token with teamId
  const empLogin2 = await request("POST", "/api/auth/login", {
    email: "audit-emp@test.com", password: "emp12345",
  });
  const empTokenFresh = empLogin2.body.token;

  // Employee creates a credential (generates CREATE_CREDENTIAL log)
  const credRes = await request("POST", "/api/credentials", {
    siteName: "Audit Test Site",
    username: "test@example.com",
    password: "test-password-123",
  }, empTokenFresh);
  assert(credRes.status === 201, `Credential created by employee`);
  const credId = credRes.body.credential._id;

  // Admin views the credential (generates VIEW_CREDENTIAL log)
  await request("GET", `/api/credentials/${credId}`, null, adminToken);

  // At this point we have multiple audit events from different users and action types.

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. CRITICAL: Non-admin role enforcement
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n2️⃣  🔥 CRITICAL: Non-admin tries GET /api/audit-logs...\n");

  const empAudit = await request("GET", "/api/audit-logs", null, empTokenFresh);

  assert(empAudit.status === 403, `Employee got ${empAudit.status} (expected 403)`);
  assert(!empAudit.body.logs, `No logs leaked to employee`);
  console.log(`  Response: ${JSON.stringify(empAudit.body)}`);

  // Also test the users sub-endpoint
  const empUsers = await request("GET", "/api/audit-logs/users", null, empTokenFresh);
  assert(empUsers.status === 403, `Employee /users endpoint: ${empUsers.status} (expected 403)`);

  // ── 3. Admin CAN access audit logs ──
  console.log("\n3️⃣  Admin accesses audit logs (should work)...\n");

  const adminAudit = await request("GET", "/api/audit-logs", null, adminToken);

  assert(adminAudit.status === 200, `Admin got ${adminAudit.status} (expected 200)`);
  assert(adminAudit.body.logs?.length > 0, `Logs returned: ${adminAudit.body.logs?.length} entries`);
  assert(adminAudit.body.pagination != null, `Pagination present`);

  // Verify the expected action types exist
  const actions = adminAudit.body.logs.map(l => l.action);
  assert(actions.includes("CREATE_CREDENTIAL"), `CREATE_CREDENTIAL found in logs`);
  assert(actions.includes("VIEW_CREDENTIAL"), `VIEW_CREDENTIAL found in logs`);
  assert(actions.includes("LOGIN"), `LOGIN found in logs`);

  // ── 4. Filter by userId ──
  console.log("\n4️⃣  Filter by userId (employee only)...\n");

  const filteredByUser = await request("GET", `/api/audit-logs?userId=${empId}`, null, adminToken);

  assert(filteredByUser.status === 200, `Filtered request succeeded`);
  const allFromEmp = filteredByUser.body.logs.every(l => l.userId?._id === empId || l.userId === empId);
  assert(allFromEmp, `All ${filteredByUser.body.logs.length} results belong to employee`);
  assert(filteredByUser.body.logs.length < adminAudit.body.logs.length,
    `Filtered (${filteredByUser.body.logs.length}) < unfiltered (${adminAudit.body.logs.length})`);

  // ── 5. Filter by action ──
  console.log("\n5️⃣  Filter by action (LOGIN only)...\n");

  const filteredByAction = await request("GET", `/api/audit-logs?action=LOGIN`, null, adminToken);

  assert(filteredByAction.status === 200, `Filtered request succeeded`);
  const allLogin = filteredByAction.body.logs.every(l => l.action === "LOGIN");
  assert(allLogin, `All ${filteredByAction.body.logs.length} results are LOGIN`);
  assert(filteredByAction.body.logs.length < adminAudit.body.logs.length,
    `Filtered (${filteredByAction.body.logs.length}) < unfiltered (${adminAudit.body.logs.length})`);

  // ── 6. Combined filters ──
  console.log("\n6️⃣  Combined filter: userId + action...\n");

  const combined = await request("GET", `/api/audit-logs?userId=${empId}&action=LOGIN`, null, adminToken);

  assert(combined.status === 200, `Combined filter succeeded`);
  const allMatch = combined.body.logs.every(l =>
    (l.userId?._id === empId || l.userId === empId) && l.action === "LOGIN"
  );
  assert(allMatch, `All ${combined.body.logs.length} results match both filters`);
  assert(combined.body.logs.length <= filteredByAction.body.logs.length,
    `Combined (${combined.body.logs.length}) <= action-only (${filteredByAction.body.logs.length})`);

  // ── 7. Unauthenticated access ──
  console.log("\n7️⃣  Unauthenticated request (no token)...\n");

  const noAuth = await request("GET", "/api/audit-logs", null, null);
  assert(noAuth.status === 401, `No-token got ${noAuth.status} (expected 401)`);

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
