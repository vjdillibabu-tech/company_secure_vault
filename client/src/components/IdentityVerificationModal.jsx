import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * OTP-based identity verification modal for password reveal.
 *
 * Flow:
 * 1. User clicks eye icon → this modal opens and auto-sends OTP
 * 2. User enters 6-digit OTP received via email
 * 3. Backend verifies OTP and returns a reveal token
 * 4. Parent uses reveal token to fetch the decrypted password
 */
function IdentityVerificationModal({ isOpen, onClose, onVerificationSuccess, credentialId }) {
  const { user, api } = useAuth();

  // OTP input state — 6 individual digit refs
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);

  // Flow state
  const [step, setStep] = useState("sending"); // "sending" | "input" | "verifying" | "success" | "error"
  const [maskedEmail, setMaskedEmail] = useState("");
  const [error, setError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);

  // Countdown timer
  const [expirySeconds, setExpirySeconds] = useState(0);
  const countdownRef = useRef(null);

  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef(null);

  // Track if OTP was already sent this session (prevent double send)
  const otpSentRef = useRef(false);

  // ──────────────────────────────────────────────
  // Auto-send OTP when modal opens
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && credentialId && !otpSentRef.current) {
      otpSentRef.current = true;
      sendOTP();
    }

    if (!isOpen) {
      // Reset everything when modal closes
      otpSentRef.current = false;
      setOtpDigits(["", "", "", "", "", ""]);
      setStep("sending");
      setError("");
      setAttemptsRemaining(5);
      setExpirySeconds(0);
      setResendCooldown(0);
      clearInterval(countdownRef.current);
      clearInterval(resendTimerRef.current);
    }

    return () => {
      clearInterval(countdownRef.current);
      clearInterval(resendTimerRef.current);
    };
  }, [isOpen, credentialId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────────────────────────────────
  // Send OTP
  // ──────────────────────────────────────────────
  const sendOTP = useCallback(async () => {
    setStep("sending");
    setError("");
    setOtpDigits(["", "", "", "", "", ""]);

    try {
      const res = await api.post("/auth/password-reveal/request-otp", {
        credentialId,
      });

      setMaskedEmail(res.data.email || "");
      setStep("input");

      // Start expiry countdown
      const expiryMins = res.data.expiresInMinutes || 5;
      setExpirySeconds(expiryMins * 60);
      clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setExpirySeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start resend cooldown (60 seconds)
      setResendCooldown(60);
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(resendTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Focus first input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to send verification code.";
      if (err.response?.status === 429) {
        // Rate limited — show countdown
        const retryAfter = err.response?.data?.retryAfter || 60;
        setResendCooldown(retryAfter);
        setStep("input");
        setError(`Please wait ${retryAfter}s before requesting a new code.`);

        clearInterval(resendTimerRef.current);
        resendTimerRef.current = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(resendTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setStep("error");
        setError(msg);
      }
    }
  }, [api, credentialId]);

  // ──────────────────────────────────────────────
  // Resend OTP
  // ──────────────────────────────────────────────
  const handleResend = () => {
    if (resendCooldown > 0) return;
    sendOTP();
  };

  // ──────────────────────────────────────────────
  // OTP input handling
  // ──────────────────────────────────────────────
  const handleDigitChange = (index, value) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits entered
    if (digit && index === 5) {
      const fullCode = newDigits.join("");
      if (fullCode.length === 6) {
        verifyOTP(fullCode);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setOtpDigits(newDigits);

      // Focus appropriate input
      const nextEmpty = newDigits.findIndex((d) => !d);
      if (nextEmpty >= 0) {
        inputRefs.current[nextEmpty]?.focus();
      } else {
        inputRefs.current[5]?.focus();
        // Auto-submit
        verifyOTP(newDigits.join(""));
      }
    }
  };

  // ──────────────────────────────────────────────
  // Verify OTP
  // ──────────────────────────────────────────────
  const verifyOTP = async (code) => {
    if (!code || code.length !== 6) return;

    setStep("verifying");
    setError("");

    try {
      const res = await api.post("/auth/password-reveal/verify-otp", {
        code,
        credentialId,
      });

      setStep("success");

      // Notify parent with the reveal token
      if (onVerificationSuccess) {
        onVerificationSuccess(res.data.revealToken);
      }

      // Auto-close after brief success message
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      const data = err.response?.data;

      if (data?.maxAttemptsReached || data?.expired) {
        setError(data.message);
        setAttemptsRemaining(0);
        setStep("input");
      } else {
        setError(data?.message || "Verification failed. Please try again.");
        if (data?.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        setStep("input");
        // Clear inputs for retry
        setOtpDigits(["", "", "", "", "", ""]);
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      }
    }
  };

  const handleManualVerify = () => {
    const code = otpDigits.join("");
    verifyOTP(code);
  };

  // ──────────────────────────────────────────────
  // Close handler
  // ──────────────────────────────────────────────
  const handleClose = () => {
    clearInterval(countdownRef.current);
    clearInterval(resendTimerRef.current);
    if (onClose) onClose();
  };

  // ──────────────────────────────────────────────
  // Format countdown
  // ──────────────────────────────────────────────
  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white dark:bg-vault-card rounded-2xl shadow-2xl border border-gray-200 dark:border-vault-border overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-vault-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Verify your identity
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-vault-border/50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* ── Sending state ── */}
          {step === "sending" && (
            <div className="text-center py-8">
              <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">Sending verification code...</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                A 6-digit code will be sent to your email
              </p>
            </div>
          )}

          {/* ── Success state ── */}
          {step === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center animate-[scale-in_0.3s_ease-out]">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Identity verified
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Revealing password...
              </p>
            </div>
          )}

          {/* ── Error state (failed to send OTP) ── */}
          {step === "error" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Something went wrong
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{error}</p>
              <button
                onClick={sendOTP}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          {/* ── OTP Input state ── */}
          {(step === "input" || step === "verifying") && (
            <>
              {/* Info message */}
              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  To view this password, verify your identity. A verification code has been sent to your registered email.
                </p>
                {maskedEmail && (
                  <p className="text-blue-500 dark:text-blue-400 text-sm font-medium mt-1">
                    {maskedEmail}
                  </p>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <span>{error}</span>
                    {attemptsRemaining > 0 && attemptsRemaining < 5 && (
                      <span className="block text-xs mt-0.5 opacity-75">
                        {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* OTP Input boxes */}
              <div className="flex justify-center gap-2.5 mb-5">
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    disabled={step === "verifying" || attemptsRemaining === 0}
                    className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-200 outline-none
                      ${digit
                        ? "border-blue-500 dark:border-blue-400 bg-blue-500/5 text-gray-900 dark:text-gray-100"
                        : "border-gray-200 dark:border-vault-border bg-white dark:bg-vault-dark text-gray-900 dark:text-gray-100"
                      }
                      focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                      disabled:opacity-50 disabled:cursor-not-allowed
                      placeholder-gray-300 dark:placeholder-gray-600
                    `}
                    placeholder="·"
                  />
                ))}
              </div>

              {/* Expiry countdown */}
              {expirySeconds > 0 && (
                <div className="text-center mb-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    expirySeconds <= 60
                      ? "bg-red-500/10 text-red-500 dark:text-red-400"
                      : "bg-gray-100 dark:bg-vault-dark text-gray-500 dark:text-gray-400"
                  }`}>
                    Code expires in {formatCountdown(expirySeconds)}
                  </span>
                </div>
              )}

              {expirySeconds === 0 && step === "input" && (
                <div className="text-center mb-4">
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 dark:text-red-400">
                    Code expired — please request a new one
                  </span>
                </div>
              )}

              {/* Verify button */}
              <button
                onClick={handleManualVerify}
                disabled={step === "verifying" || otpDigits.join("").length !== 6 || attemptsRemaining === 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {step === "verifying" ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Verify OTP
                  </>
                )}
              </button>

              {/* Resend button */}
              <div className="text-center mt-4">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || step === "verifying"}
                  className="text-sm text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resendCooldown > 0
                    ? `Resend OTP in ${resendCooldown}s`
                    : "Resend OTP"
                  }
                </button>
              </div>

              <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center leading-relaxed">
                Check your inbox (and spam folder) for the verification code.
                The code is valid for {Math.ceil(expirySeconds / 60) || 5} minute{Math.ceil(expirySeconds / 60) !== 1 ? "s" : ""}.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default IdentityVerificationModal;
