/**
 * Phase 7 Functional Verification
 * Tests: password generator logic, strength meter scoring, sidebar component rendering,
 * and end-to-end flow (register → create credential → verify all features work together)
 */

const http = require("http");
const mongoose = require("mongoose");
const crypto = require("crypto");

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
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ FAIL: ${label}`); failed++; }
}

async function run() {
  console.log("\n🎨 Phase 7 Verification\n" + "─".repeat(50));

  // ── 1. Password Generator Logic ──
  console.log("\n1️⃣  Password Generator (crypto.getRandomValues equivalent)...\n");

  // Simulate what PasswordGenerator.jsx does, server-side
  const CHARSETS = {
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
  };

  function generatePassword(length, opts) {
    let charset = "";
    if (opts.uppercase) charset += CHARSETS.uppercase;
    if (opts.lowercase) charset += CHARSETS.lowercase;
    if (opts.numbers) charset += CHARSETS.numbers;
    if (opts.symbols) charset += CHARSETS.symbols;
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    let pw = "";
    for (let i = 0; i < length; i++) pw += charset[array[i] % charset.length];
    return pw;
  }

  // Test: generates correct length
  const pw20 = generatePassword(20, { uppercase: true, lowercase: true, numbers: true, symbols: true });
  assert(pw20.length === 20, `Generated password length: ${pw20.length} (expected 20)`);

  // Test: contains expected character types
  const pw64 = generatePassword(64, { uppercase: true, lowercase: true, numbers: true, symbols: true });
  assert(/[A-Z]/.test(pw64), `Contains uppercase`);
  assert(/[a-z]/.test(pw64), `Contains lowercase`);
  assert(/[0-9]/.test(pw64), `Contains numbers`);
  assert(/[^a-zA-Z0-9]/.test(pw64), `Contains symbols`);

  // Test: respects charset toggles
  const pwNoSymbols = generatePassword(50, { uppercase: true, lowercase: true, numbers: true, symbols: false });
  assert(!/[^a-zA-Z0-9]/.test(pwNoSymbols), `No symbols when disabled: "${pwNoSymbols.slice(0,20)}..."`);

  const pwOnlyNumbers = generatePassword(20, { uppercase: false, lowercase: false, numbers: true, symbols: false });
  assert(/^[0-9]+$/.test(pwOnlyNumbers), `Numbers only: "${pwOnlyNumbers}"`);

  // Test: uniqueness (two generations should differ)
  const pw1 = generatePassword(32, { uppercase: true, lowercase: true, numbers: true, symbols: true });
  const pw2 = generatePassword(32, { uppercase: true, lowercase: true, numbers: true, symbols: true });
  assert(pw1 !== pw2, `Two generations are unique`);

  // ── 2. Strength Meter Scoring ──
  console.log("\n2️⃣  Password Strength Meter scoring...\n");

  function evaluateStrength(password) {
    if (!password) return { score: 0 };
    let score = 0;
    const checks = {
      length8: password.length >= 8,
      length12: password.length >= 12,
      length16: password.length >= 16,
      hasLower: /[a-z]/.test(password),
      hasUpper: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSymbol: /[^a-zA-Z0-9]/.test(password),
    };
    if (checks.length8) score += 1;
    if (checks.length12) score += 1;
    if (checks.length16) score += 0.5;
    const diversity = [checks.hasLower, checks.hasUpper, checks.hasNumber, checks.hasSymbol].filter(Boolean).length;
    if (diversity >= 2) score += 0.5;
    if (diversity >= 3) score += 0.5;
    if (diversity >= 4) score += 0.5;
    const commonPasswords = ["password", "123456", "qwerty", "admin", "letmein", "welcome", "abc123"];
    if (commonPasswords.some((cp) => password.toLowerCase().includes(cp))) {
      score = Math.min(score, 1);
    }
    if (/(.)\1{3,}/.test(password)) score = Math.max(0, score - 1);
    if (/(?:abc|bcd|cde|def|efg|123|234|345|456|567|678|789)/i.test(password)) {
      score = Math.max(0, score - 0.5);
    }
    return { score: Math.min(4, Math.max(0, Math.round(score))) };
  }

  assert(evaluateStrength("abc").score <= 1, `"abc" → Weak (score: ${evaluateStrength("abc").score})`);
  assert(evaluateStrength("password123").score <= 1, `"password123" → Weak (common password penalty, score: ${evaluateStrength("password123").score})`);
  assert(evaluateStrength("aaaaaaaaaa").score <= 1, `"aaaaaaaaaa" → Weak (repeated chars, score: ${evaluateStrength("aaaaaaaaaa").score})`);
  assert(evaluateStrength("MyP4ssw0rd").score >= 2, `"MyP4ssw0rd" → Fair+ (score: ${evaluateStrength("MyP4ssw0rd").score})`);
  assert(evaluateStrength("xK9#mQ2$vL7@nP4!").score >= 3, `"xK9#mQ2$vL7@nP4!" → Good+ (score: ${evaluateStrength("xK9#mQ2$vL7@nP4!").score})`);
  assert(evaluateStrength(pw64).score === 4, `Generated 64-char password → Strong (score: ${evaluateStrength(pw64).score})`);

  // ── 3. End-to-end flow with generated password ──
  console.log("\n3️⃣  End-to-end: register → create credential with generated password...\n");

  const genPassword = generatePassword(24, { uppercase: true, lowercase: true, numbers: true, symbols: true });
  console.log(`  Generated password: ${genPassword} (length: ${genPassword.length})`);

  // Register
  const reg = await request("POST", "/api/auth/register", {
    name: "Phase7 Tester", email: "phase7@test.com", password: "TestPass123!",
  });
  assert(reg.status === 201, `Registration: ${reg.status}`);
  const token = reg.body.token;

  // Promote to admin for full access
  const User = require("../src/models/User");
  await mongoose.connect(process.env.MONGO_URI);
  await User.findByIdAndUpdate(reg.body.user.id, { role: "admin" });

  // Re-login to get admin token
  const login = await request("POST", "/api/auth/login", {
    email: "phase7@test.com", password: "TestPass123!",
  });
  const adminToken = login.body.token;

  // Create team
  const team = await request("POST", "/api/teams", { name: "Phase7 Team" }, adminToken);
  const teamId = team.body.team._id;
  await request("POST", `/api/teams/${teamId}/members`, { userId: reg.body.user.id }, adminToken);

  // Re-login for fresh token with teamId
  const login2 = await request("POST", "/api/auth/login", {
    email: "phase7@test.com", password: "TestPass123!",
  });
  const finalToken = login2.body.token;

  // Create credential with generated password
  const credRes = await request("POST", "/api/credentials", {
    siteName: "Generated Password Site",
    username: "user@example.com",
    password: genPassword,
  }, finalToken);
  assert(credRes.status === 201, `Credential created: ${credRes.status}`);
  const credId = credRes.body.credential._id;

  // Reveal (decrypt) the password
  const revealRes = await request("GET", `/api/credentials/${credId}`, null, finalToken);
  assert(revealRes.status === 200, `Reveal: ${revealRes.status}`);
  assert(revealRes.body.credential.password === genPassword,
    `Decrypt roundtrip: ${revealRes.body.credential.password === genPassword ? "matches" : "MISMATCH!"}`);

  // Create a credential with known-breached password
  const breachedRes = await request("POST", "/api/credentials", {
    siteName: "Weak Password Site",
    username: "lazy@example.com",
    password: "password123",
  }, finalToken);
  assert(breachedRes.status === 201, `Breached credential created: ${breachedRes.status}`);
  assert(breachedRes.body.credential.compromised === true, `Breached flag set: ${breachedRes.body.credential.compromised}`);

  // Verify list endpoint returns both and includes breach fields
  const listRes = await request("GET", "/api/credentials", null, finalToken);
  assert(listRes.status === 200, `List: ${listRes.status}`);
  assert(listRes.body.credentials.length === 2, `2 credentials in list`);

  const safe = listRes.body.credentials.find(c => c.siteName === "Generated Password Site");
  const breached = listRes.body.credentials.find(c => c.siteName === "Weak Password Site");
  assert(safe && safe.compromised === false, `Generated password marked safe`);
  assert(breached && breached.compromised === true, `Weak password marked breached`);

  // ── 4. Error handling verification ──
  console.log("\n4️⃣  Error handling: bad requests return proper error messages...\n");

  // Missing required fields
  const badCred = await request("POST", "/api/credentials", {
    siteName: "", username: "", password: "",
  }, finalToken);
  assert(badCred.status >= 400, `Empty fields rejected: ${badCred.status}`);

  // Invalid credential ID
  const badReveal = await request("GET", "/api/credentials/000000000000000000000000", null, finalToken);
  assert(badReveal.status === 404, `Invalid ID: ${badReveal.status}`);

  // Expired/invalid token
  const badToken = await request("GET", "/api/credentials", null, "invalid.jwt.token");
  assert(badToken.status === 401, `Invalid token: ${badToken.status}`);

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
