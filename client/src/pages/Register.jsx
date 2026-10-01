import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RoleInfoCard from "../components/RoleInfoCard";
import ROLES, { getRoleByValue } from "../config/roleConfig";
import { getDashboardPath } from "../config/credentialConfig";
import { EyeIcon } from "../components/EyeIcon";
import { EyeSlashIcon } from "../components/EyeSlashIcon";

// ─── Password strength calculator ────────────────────
function getPasswordStrength(password) {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const map = [
    { label: "", color: "" },
    { label: "Very Weak", color: "bg-red-500" },
    { label: "Weak", color: "bg-orange-500" },
    { label: "Fair", color: "bg-yellow-500" },
    { label: "Strong", color: "bg-emerald-500" },
    { label: "Very Strong", color: "bg-green-500" },
  ];
  return { score, ...map[score] };
}

// ─── Validation helpers ──────────────────────────────
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validateUsername(username) {
  // 3-30 chars, alphanumeric + underscores/hyphens, must start with letter
  return /^[a-zA-Z][a-zA-Z0-9_-]{2,29}$/.test(username);
}

function Register() {
  // ─── Form state ────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // ─── Touch state (show validation only after blur) ─
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedUsername, setTouchedUsername] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  // ─── Derived state ─────────────────────────────────
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const selectedRole = useMemo(() => getRoleByValue(role), [role]);

  const emailError = touchedEmail && email && !validateEmail(email) ? "Please enter a valid email address" : "";
  const usernameError = touchedUsername && username && !validateUsername(username)
    ? "3-30 characters, start with a letter, only letters/numbers/underscores/hyphens"
    : "";
  const confirmError = touchedConfirm && confirmPassword && password !== confirmPassword ? "Passwords do not match" : "";

  // ─── Submit handler ────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!name.trim()) { setError("Full name is required."); return; }
    if (!validateEmail(email)) { setError("Please enter a valid email address."); return; }
    if (!validateUsername(username)) { setError("Username must be 3-30 characters, start with a letter."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!role) { setError("Please select a role."); return; }

    setSubmitting(true);

    try {
      const data = await register(name, email, password, role, username);
      setRegistrationSuccess(true);
      // Redirect to role-based dashboard based on the actual role from backend
      const dashPath = getDashboardPath(data.user.role);
      setTimeout(() => {
        navigate(dashPath, { replace: true });
      }, 800);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Shared input classes ──────────────────────────
  const inputBase =
    "w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200";
  const inputError = "border-red-400 dark:border-red-500 focus:ring-red-400";
  const labelBase = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-12 cyber-grid-bg bg-gray-50 dark:bg-vault-dark">
      <div className="w-full max-w-xl">
        {/* ═══ Header ═══ */}
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary-500 dark:text-primary-400 hover:text-primary-400 dark:hover:text-primary-300 transition-colors mb-6"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>

          {/* Lock icon with pulse animation */}
          <div className="flex justify-center mb-5">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg animate-pulse-glow ${registrationSuccess ? "success-flash" : ""}`}>
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            Create your account
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Join your organization's secure vault
          </p>
        </div>

        {/* ═══ Error banner ═══ */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-3 animate-[shake_0.3s_ease-in-out]">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* ═══ Form Card ═══ */}
        <form
          onSubmit={handleSubmit}
          className={`p-8 rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border shadow-xl ${registrationSuccess ? "success-flash" : ""}`}
        >
          <div className="space-y-5">
            {/* ── Full Name ── */}
            <div>
              <label htmlFor="reg-name" className={labelBase}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Full Name
                </span>
              </label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className={inputBase}
                placeholder="Jane Doe"
              />
            </div>

            {/* ── Email ── */}
            <div>
              <label htmlFor="reg-email" className={labelBase}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email Address
                </span>
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouchedEmail(true)}
                required
                autoComplete="email"
                className={`${inputBase} ${emailError ? inputError : ""}`}
                placeholder="jane@company.com"
              />
              {emailError && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                  </svg>
                  {emailError}
                </p>
              )}
            </div>

            {/* ── Username ── */}
            <div>
              <label htmlFor="reg-username" className={labelBase}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  Username
                </span>
              </label>
              <input
                id="reg-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => setTouchedUsername(true)}
                required
                autoComplete="username"
                className={`${inputBase} ${usernameError ? inputError : ""}`}
                placeholder="jane_doe"
              />
              {usernameError && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                  </svg>
                  {usernameError}
                </p>
              )}
            </div>

            {/* ── Role Dropdown ── */}
            <div>
              <label htmlFor="reg-role" className={labelBase}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Role
                </span>
              </label>
              <div className="relative">
                <select
                  id="reg-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={`${inputBase} appearance-none cursor-pointer pr-10`}
                >
                  <option value="" disabled>
                    Select your role...
                  </option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.icon} {r.label}
                    </option>
                  ))}
                </select>
                {/* Dropdown chevron */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Role Information Card */}
              <RoleInfoCard role={selectedRole} />

              {/* Security notice */}
              {role && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-blue-50/70 dark:bg-blue-900/10 border border-blue-200/60 dark:border-blue-800/30">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                    <strong>Note:</strong> Your selected role will be saved to your account. After registration, you'll be directed to your role-specific dashboard.
                  </p>
                </div>
              )}
            </div>

            {/* ── Password ── */}
            <div>
              <label htmlFor="reg-password" className={labelBase}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Password
                </span>
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`${inputBase} pr-12`}
                  placeholder="Min. 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Password strength indicator */}
              {password && (
                <div className="mt-2.5">
                  <div className="flex gap-1.5 mb-1.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          passwordStrength.score >= level
                            ? passwordStrength.color
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${
                    passwordStrength.score <= 1 ? "text-red-500" :
                    passwordStrength.score <= 2 ? "text-orange-500" :
                    passwordStrength.score <= 3 ? "text-yellow-600" :
                    "text-emerald-600"
                  }`}>
                    {passwordStrength.label}
                    {passwordStrength.score <= 3 && passwordStrength.score > 0 && (
                      <span className="text-gray-400 font-normal"> — Add uppercase, numbers & symbols</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* ── Confirm Password ── */}
            <div>
              <label htmlFor="reg-confirm" className={labelBase}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Confirm Password
                </span>
              </label>
              <div className="relative">
                <input
                  id="reg-confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => setTouchedConfirm(true)}
                  required
                  autoComplete="new-password"
                  className={`${inputBase} pr-12 ${confirmError ? inputError : ""}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
              {confirmError && (
                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {confirmError}
                </p>
              )}
              {/* Match indicator */}
              {confirmPassword && password === confirmPassword && (
                <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Passwords match
                </p>
              )}
            </div>
          </div>

          {/* ═══ Submit Button ═══ */}
          <button
            type="submit"
            disabled={submitting || registrationSuccess}
            className="mt-8 w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {registrationSuccess ? (
              <span className="inline-flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Account Created!
              </span>
            ) : submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating account…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Create Account
              </span>
            )}
          </button>

          {/* ═══ Registration Flow Steps ═══ */}
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-vault-border">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3 uppercase tracking-wider font-medium">
              Registration Flow
            </p>
            <div className="flex items-center justify-center gap-1 flex-wrap">
              {[
                { label: "Register", icon: "📝", active: true },
                { label: "Email OTP", icon: "📧" },
                { label: "Phone OTP", icon: "📱" },
                { label: "Login", icon: "🔐" },
                { label: "Dashboard", icon: "🖥️" },
              ].map((step, i, arr) => (
                <span key={i} className="flex items-center gap-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                      step.active
                        ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20"
                        : "bg-gray-100 dark:bg-vault-dark text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-vault-border"
                    }`}
                  >
                    <span className="text-xs">{step.icon}</span>
                    {step.label}
                  </span>
                  {i < arr.length - 1 && (
                    <svg className="w-3 h-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </span>
              ))}
            </div>
          </div>
        </form>

        {/* ═══ Login link ═══ */}
        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-primary-500 dark:text-primary-400 hover:text-primary-400 dark:hover:text-primary-300 font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
