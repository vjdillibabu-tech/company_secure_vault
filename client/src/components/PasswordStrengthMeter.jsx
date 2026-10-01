import { useMemo } from "react";

/**
 * Evaluate password strength on a 0-4 scale.
 * Criteria: length, character diversity, common patterns.
 */
function evaluateStrength(password) {
  if (!password) return { score: 0, label: "", feedback: "" };

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

  // Length scoring
  if (checks.length8) score += 1;
  if (checks.length12) score += 1;
  if (checks.length16) score += 0.5;

  // Character diversity
  const diversity = [checks.hasLower, checks.hasUpper, checks.hasNumber, checks.hasSymbol].filter(Boolean).length;
  if (diversity >= 2) score += 0.5;
  if (diversity >= 3) score += 0.5;
  if (diversity >= 4) score += 0.5;

  // Penalties for common patterns
  const commonPasswords = ["password", "123456", "qwerty", "admin", "letmein", "welcome", "abc123"];
  if (commonPasswords.some((cp) => password.toLowerCase().includes(cp))) {
    score = Math.min(score, 1);
  }

  // Repeated characters penalty
  if (/(.)\1{3,}/.test(password)) {
    score = Math.max(0, score - 1);
  }

  // Sequential characters penalty
  if (/(?:abc|bcd|cde|def|efg|123|234|345|456|567|678|789)/i.test(password)) {
    score = Math.max(0, score - 0.5);
  }

  // Clamp score
  const finalScore = Math.min(4, Math.max(0, Math.round(score)));

  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const feedback = [
    "",
    "Add more characters and mix character types.",
    "Getting there — try adding symbols or more length.",
    "Solid password. Adding symbols would make it stronger.",
    "Excellent — this password is very strong.",
  ];

  return { score: finalScore, label: labels[finalScore], feedback: feedback[finalScore] };
}

function PasswordStrengthMeter({ password }) {
  const strength = useMemo(() => evaluateStrength(password), [password]);

  if (!password) return null;

  const colors = [
    "", // 0 — no display
    "bg-red-500",
    "bg-amber-500",
    "bg-yellow-400",
    "bg-emerald-500",
  ];

  const textColors = [
    "",
    "text-red-500 dark:text-red-400",
    "text-amber-500 dark:text-amber-400",
    "text-yellow-500 dark:text-yellow-400",
    "text-emerald-500 dark:text-emerald-400",
  ];

  return (
    <div className="mt-2 space-y-1.5">
      {/* Strength bars */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              level <= strength.score
                ? colors[strength.score]
                : "bg-gray-200 dark:bg-vault-border/50"
            }`}
          />
        ))}
      </div>

      {/* Label + feedback */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${textColors[strength.score]}`}>
          {strength.label}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{strength.feedback}</span>
      </div>
    </div>
  );
}

export default PasswordStrengthMeter;
