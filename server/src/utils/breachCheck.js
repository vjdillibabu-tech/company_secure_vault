const crypto = require("crypto");
const https = require("https");

/**
 * Check a plaintext password against the HaveIBeenPwned k-anonymity API.
 *
 * How it works:
 *   1. SHA-1 hash the password
 *   2. Send the first 5 hex characters (prefix) to the HIBP range API
 *   3. HIBP returns all known hash suffixes matching that prefix
 *   4. Check if our full suffix appears in the response
 *
 * This never sends the full password or full hash over the network.
 *
 * @param {string} password - The plaintext password to check
 * @returns {Promise<{ compromised: boolean, count: number }>}
 */
async function checkBreach(password) {
  const sha1 = crypto
    .createHash("sha1")
    .update(password)
    .digest("hex")
    .toUpperCase();

  const prefix = sha1.substring(0, 5);
  const suffix = sha1.substring(5);

  try {
    const responseBody = await fetchRange(prefix);

    // Each line in the response is: SUFFIX:COUNT
    const lines = responseBody.split("\r\n");

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix === suffix) {
        return { compromised: true, count: parseInt(countStr, 10), breachCheckFailed: false };
      }
    }

    return { compromised: false, count: 0, breachCheckFailed: false };
  } catch (error) {
    // If the API is unreachable, don't block the operation — just log and return unknown
    console.error("HIBP breach check failed:", error.message);
    return { compromised: false, count: 0, breachCheckFailed: true };
  }
}

/**
 * Fetch hash range from HIBP API using Node's built-in https module.
 */
function fetchRange(prefix) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.pwnedpasswords.com",
      path: `/range/${prefix}`,
      method: "GET",
      headers: {
        "User-Agent": "CompanyPasswordVault-BreachCheck",
        "Add-Padding": "true", // Adds padding to prevent response-length analysis
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HIBP API returned status ${res.statusCode}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error("HIBP API request timed out"));
    });
    req.end();
  });
}

module.exports = { checkBreach };
