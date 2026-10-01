/**
 * Phase 8 Verification Tests
 * Tests: profile update, password change (correct + incorrect), audit log entries
 */
const http = require("http");

const BASE = "http://localhost:5000";
let TOKEN = "";
let USER_ID = "";
const TEST_EMAIL = `phase8test_${Date.now()}@test.com`;
const TEST_PASSWORD = "TestPass123!";
const NEW_PASSWORD = "NewPass456!";

const results = [];

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const r = http.request(options, (res) => {
      let chunks = "";
      res.on("data", (c) => (chunks += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, data: chunks });
        }
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function log(feature, expected, actual, pass) {
  const status = pass ? "✅ PASS" : "❌ FAIL";
  results.push({ feature, expected, actual, status });
  console.log(`${status} | ${feature} | Expected: ${expected} | Actual: ${actual}`);
}

async function run() {
  console.log("=== Phase 8 Verification Tests ===\n");

  // 1. Register test user
  console.log("--- Registering test user ---");
  const regRes = await req("POST", "/api/auth/register", {
    name: "Phase8 Tester",
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    role: "employee",
  });
  TOKEN = regRes.data.token;
  USER_ID = regRes.data.user?.id;
  log(
    "Register test user",
    "201",
    String(regRes.status),
    regRes.status === 201
  );

  // 2. GET /api/auth/me
  console.log("\n--- GET /api/auth/me ---");
  const meRes = await req("GET", "/api/auth/me", null, TOKEN);
  log(
    "GET /api/auth/me returns profile",
    "200 with name/email",
    `${meRes.status}, name=${meRes.data.user?.name}`,
    meRes.status === 200 && meRes.data.user?.name === "Phase8 Tester"
  );

  // 3. PUT /api/auth/profile — update name
  console.log("\n--- PUT /api/auth/profile ---");
  const profileRes = await req("PUT", "/api/auth/profile", {
    name: "Updated Tester",
    email: TEST_EMAIL,
  }, TOKEN);
  log(
    "PUT /api/auth/profile updates name",
    "200, name=Updated Tester",
    `${profileRes.status}, name=${profileRes.data.user?.name}`,
    profileRes.status === 200 && profileRes.data.user?.name === "Updated Tester"
  );

  // 4. Verify profile update via GET /me
  const meRes2 = await req("GET", "/api/auth/me", null, TOKEN);
  log(
    "GET /me reflects updated name",
    "Updated Tester",
    meRes2.data.user?.name,
    meRes2.data.user?.name === "Updated Tester"
  );

  // 5. PUT /api/auth/change-password with WRONG current password → 403
  console.log("\n--- PUT /api/auth/change-password (wrong password) ---");
  const wrongPwRes = await req("PUT", "/api/auth/change-password", {
    currentPassword: "WrongPassword999",
    newPassword: NEW_PASSWORD,
  }, TOKEN);
  log(
    "Change password with wrong current → 403",
    "403",
    String(wrongPwRes.status),
    wrongPwRes.status === 403
  );
  log(
    "Error message for wrong password",
    "Current password is incorrect.",
    wrongPwRes.data.message,
    wrongPwRes.data.message === "Current password is incorrect."
  );

  // 6. PUT /api/auth/change-password with CORRECT current password → 200
  console.log("\n--- PUT /api/auth/change-password (correct password) ---");
  const correctPwRes = await req("PUT", "/api/auth/change-password", {
    currentPassword: TEST_PASSWORD,
    newPassword: NEW_PASSWORD,
  }, TOKEN);
  log(
    "Change password with correct current → 200",
    "200",
    String(correctPwRes.status),
    correctPwRes.status === 200
  );

  // 7. Login with OLD password should FAIL
  console.log("\n--- Login with OLD password ---");
  const oldLoginRes = await req("POST", "/api/auth/login", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  log(
    "Login with old password fails",
    "401",
    String(oldLoginRes.status),
    oldLoginRes.status === 401
  );

  // 8. Login with NEW password should SUCCEED
  console.log("\n--- Login with NEW password ---");
  const newLoginRes = await req("POST", "/api/auth/login", {
    email: TEST_EMAIL,
    password: NEW_PASSWORD,
  });
  log(
    "Login with new password succeeds",
    "200",
    String(newLoginRes.status),
    newLoginRes.status === 200
  );

  // 9. PUT /api/auth/change-password with too-short new password → 400
  console.log("\n--- Change password with short new password ---");
  const shortPwRes = await req("PUT", "/api/auth/change-password", {
    currentPassword: NEW_PASSWORD,
    newPassword: "ab",
  }, TOKEN);
  log(
    "Short new password rejected → 400",
    "400",
    String(shortPwRes.status),
    shortPwRes.status === 400
  );

  // 10. Profile update with profilePicture field
  console.log("\n--- Profile update with picture ---");
  const picRes = await req("PUT", "/api/auth/profile", {
    name: "Updated Tester",
    email: TEST_EMAIL,
    profilePicture: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  }, TOKEN);
  log(
    "Profile picture saved as base64",
    "200 with profilePicture",
    `${picRes.status}, hasPic=${!!picRes.data.user?.profilePicture}`,
    picRes.status === 200 && !!picRes.data.user?.profilePicture
  );

  // 11. Unauthenticated access to /api/auth/me → 401
  console.log("\n--- Unauthenticated /api/auth/me ---");
  const noAuthRes = await req("GET", "/api/auth/me", null);
  log(
    "GET /me without token → 401",
    "401",
    String(noAuthRes.status),
    noAuthRes.status === 401
  );

  // ── Summary ──
  console.log("\n\n========================================");
  console.log("         VERIFICATION SUMMARY");
  console.log("========================================\n");

  const passed = results.filter((r) => r.status === "✅ PASS").length;
  const failed = results.filter((r) => r.status === "❌ FAIL").length;

  console.log("Feature | Expected | Actual | Status");
  console.log("--------|----------|--------|-------");
  for (const r of results) {
    console.log(`${r.feature} | ${r.expected} | ${r.actual} | ${r.status}`);
  }

  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(failed === 0 ? "\n🎉 ALL TESTS PASSED!" : "\n⚠️  SOME TESTS FAILED!");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
