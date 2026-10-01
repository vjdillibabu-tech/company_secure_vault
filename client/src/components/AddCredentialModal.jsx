import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import PasswordGenerator from "./PasswordGenerator";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import { getCategoryIcon, getCategoryColor, getRoleDisplay } from "../config/credentialConfig";

/**
 * ────────────────────────────────────────────────────────
 * AddCredentialModal — Role-Based Credential Creation
 * ────────────────────────────────────────────────────────
 * Step 1: Select Credential Category (role-filtered)
 * Step 2: Fill credential form (role-specific fields)
 *
 * Categories and permissions are fetched from the backend
 * API so the frontend never overrides access control.
 * ────────────────────────────────────────────────────────
 */
function AddCredentialModal({ isOpen, onClose, onSaved, editingCredential }) {
  const { api, user } = useAuth();

  // ── Permission state (from backend) ───────────────
  const [permissions, setPermissions] = useState(null);
  const [loadingPerms, setLoadingPerms] = useState(true);

  // ── Step state ─────────────────────────────────────
  const [step, setStep] = useState(editingCredential ? 2 : 1); // 1 = category, 2 = form

  // ── Form state ─────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState(editingCredential?.category || "");
  const [credentialName, setCredentialName] = useState(editingCredential?.credentialName || editingCredential?.siteName || "");
  const [username, setUsername] = useState(editingCredential?.username || "");
  const [password, setPassword] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(editingCredential?.websiteUrl || "");
  const [environment, setEnvironment] = useState(editingCredential?.environment || "");
  const [accessLevel, setAccessLevel] = useState(editingCredential?.accessLevel || "private");
  const [team, setTeam] = useState(editingCredential?.teamId || "");
  const [project, setProject] = useState(editingCredential?.project || "");
  const [description, setDescription] = useState(editingCredential?.description || "");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [breachWarning, setBreachWarning] = useState("");
  const [breachShake, setBreachShake] = useState(false);
  const [teams, setTeams] = useState([]);

  // ── Access Request state ───────────────────────────
  const [showAccessRequest, setShowAccessRequest] = useState(false);
  const [accessRequestReason, setAccessRequestReason] = useState("");
  const [accessRequestResourceName, setAccessRequestResourceName] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const isEditing = !!editingCredential;
  const roleDisplay = getRoleDisplay(user?.role);

  // ── Fetch permissions from backend on mount ────────
  useEffect(() => {
    if (!isOpen) return;
    const fetchPerms = async () => {
      try {
        setLoadingPerms(true);
        const res = await api.get("/credentials/permissions");
        setPermissions(res.data.permissions);
      } catch (err) {
        setError("Failed to load credential permissions.");
      } finally {
        setLoadingPerms(false);
      }
    };
    fetchPerms();
  }, [isOpen, api]);

  // ── Fetch teams for team selector ──────────────────
  useEffect(() => {
    if (!isOpen) return;
    const fetchTeams = async () => {
      try {
        const res = await api.get("/teams");
        setTeams(res.data.teams || []);
      } catch {
        // Teams might not be available for all roles
      }
    };
    fetchTeams();
  }, [isOpen, api]);

  // ── Handle category selection ──────────────────────
  const handleCategorySelect = (categoryValue) => {
    setSelectedCategory(categoryValue);
    setStep(2);
  };

  // ── Handle access request submission ───────────────
  const handleAccessRequest = async (e) => {
    e.preventDefault();
    if (!accessRequestReason || !accessRequestResourceName) {
      setError("Please provide a resource name and reason.");
      return;
    }
    setSubmittingRequest(true);
    setError("");
    try {
      await api.post("/credentials/access-request", {
        requestType: "production_credential",
        category: selectedCategory || "production",
        reason: accessRequestReason,
        resourceName: accessRequestResourceName,
      });
      setRequestSuccess(true);
      setTimeout(() => {
        setShowAccessRequest(false);
        setRequestSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit access request.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  // ── Handle form submit ─────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBreachWarning("");
    setSaving(true);

    try {
      let res;
      if (isEditing) {
        const body = {
          credentialName,
          username,
          websiteUrl,
          category: selectedCategory,
          environment,
          accessLevel,
          project,
          description,
        };
        if (password) body.password = password;
        res = await api.put(`/credentials/${editingCredential._id}`, body);
      } else {
        if (!password) {
          setError("Password is required.");
          setSaving(false);
          return;
        }
        res = await api.post("/credentials", {
          credentialName,
          username,
          password,
          websiteUrl,
          category: selectedCategory,
          environment,
          accessLevel,
          teamId: team || undefined,
          project,
          description,
        });
      }

      // Check if the API flagged this password as breached
      if (res.data.credential?.compromised) {
        setBreachWarning(res.data.message);
        setBreachShake(true);
        setTimeout(() => setBreachShake(false), 600);
        onSaved();
      } else {
        onSaved();
        onClose();
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresApproval) {
        setShowAccessRequest(true);
        setError("");
      } else {
        setError(data?.message || "Failed to save credential.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // ── Loading State ──────────────────────────────────
  if (loadingPerms) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border shadow-2xl p-12 text-center">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading permissions...</p>
        </div>
      </div>
    );
  }

  // ── Access Request Modal ───────────────────────────
  if (showAccessRequest) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border shadow-2xl">
          <div className="p-6 border-b border-gray-200 dark:border-vault-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <span className="text-xl">🔒</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {user?.role === "developer"
                    ? "Production Credential Requires Approval"
                    : "Access Requires Approval"}
                </h2>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {user?.role === "developer"
                ? "You cannot directly create production credentials. Submit an access request for approval."
                : "This resource requires Manager/Admin approval. Submit a request below."}
            </p>
          </div>

          {requestSuccess ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Request Submitted!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">An administrator will review your request.</p>
            </div>
          ) : (
            <form onSubmit={handleAccessRequest} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Resource Name
                </label>
                <input
                  type="text"
                  value={accessRequestResourceName}
                  onChange={(e) => setAccessRequestResourceName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="e.g. Production Database, AWS Console"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Reason for Access
                </label>
                <textarea
                  value={accessRequestReason}
                  onChange={(e) => setAccessRequestReason(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                  placeholder="Explain why you need access to this resource..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAccessRequest(false); setError(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-vault-border text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-vault-dark transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                >
                  {submittingRequest ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    "Request Access"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`relative w-full ${step === 1 ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col ${saving ? "scan-line-overlay" : ""}`}>

        {/* ═══ STEP 1: Category Selection ═══ */}
        {step === 1 && !isEditing && (
          <>
            <div className="p-6 border-b border-gray-200 dark:border-vault-border shrink-0">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleDisplay.gradientFrom} ${roleDisplay.gradientTo} flex items-center justify-center shadow-lg`}>
                  <span className="text-lg text-white filter drop-shadow">{roleDisplay.icon}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Select Credential Category
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${roleDisplay.bgColor} ${roleDisplay.borderColor} ${roleDisplay.color}`}>
                      {roleDisplay.label}
                    </span>
                    <span className="ml-1.5">— showing categories for your role</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {permissions?.categories?.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => handleCategorySelect(cat.value)}
                    className={`group relative p-4 rounded-xl border bg-gradient-to-br ${getCategoryColor(cat.value)} transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] hover:shadow-lg text-left`}
                  >
                    <span className="text-2xl mb-2 block">{cat.icon}</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight block">
                      {cat.label}
                    </span>
                    {/* Hover arrow */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>

              {/* Show restricted notice for developer/employee */}
              {(user?.role === "developer" || user?.role === "employee") && (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">🔒</span>
                    <div>
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {user?.role === "developer"
                          ? "Production credentials require approval"
                          : "Access requires Manager/Admin approval"}
                      </p>
                      <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                        {user?.role === "developer"
                          ? "You can request temporary production access through the access request system."
                          : "Some credential types are restricted for your role."}
                      </p>
                      <button
                        onClick={() => setShowAccessRequest(true)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Request Access
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-vault-border shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-vault-border text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-vault-dark transition-all"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ═══ STEP 2: Credential Form ═══ */}
        {step === 2 && (
          <>
            <div className="p-6 border-b border-gray-200 dark:border-vault-border shrink-0">
              <div className="flex items-center gap-3">
                {!isEditing && (
                  <button
                    onClick={() => setStep(1)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-vault-border/30 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {isEditing ? "Edit Credential" : "Add New Credential"}
                    </h2>
                    {selectedCategory && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-600 dark:text-primary-400">
                        {getCategoryIcon(selectedCategory)}
                        {permissions?.categories?.find(c => c.value === selectedCategory)?.label || selectedCategory}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {isEditing
                      ? "Update the credential details below."
                      : "Passwords are encrypted with AES-256 before storage."}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {error && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {breachWarning && (
                <div className={`mx-6 mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 ${breachShake ? "breach-shake" : ""}`}>
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-amber-500 dark:text-amber-400">Breach Detected</p>
                      <p className="text-xs text-amber-500/80 dark:text-amber-400/80 mt-1">{breachWarning}</p>
                      <p className="text-xs text-gray-500 mt-2">The credential was saved, but you should change this password immediately.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 w-full py-2 rounded-lg border border-amber-500/30 text-amber-500 dark:text-amber-400 text-sm font-medium hover:bg-amber-500/10 transition-all"
                  >
                    Understood, close
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Credential Name */}
                <div>
                  <label htmlFor="cred-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Credential Name
                  </label>
                  <input
                    id="cred-name"
                    type="text"
                    value={credentialName}
                    onChange={(e) => setCredentialName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="e.g. AWS Console, GitHub, Slack"
                  />
                </div>

                {/* Username */}
                <div>
                  <label htmlFor="cred-user" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Username / Email
                  </label>
                  <input
                    id="cred-user"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="admin@company.com"
                  />
                </div>

                {/* Password / API Key */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="cred-pass" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user?.role === "developer" ? "Password / API Key" : "Password"}{" "}
                      {isEditing && <span className="text-gray-400 dark:text-gray-500">(leave blank to keep current)</span>}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowGenerator(!showGenerator)}
                      className="text-xs text-primary-500 dark:text-primary-400 hover:text-primary-400 dark:hover:text-primary-300 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      {showGenerator ? "Hide" : "Generate"}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="cred-pass"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!isEditing}
                      className="w-full px-4 py-2.5 pr-10 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <PasswordStrengthMeter password={password} />
                </div>

                {/* Password Generator */}
                {showGenerator && (
                  <PasswordGenerator
                    onGenerate={(pw) => {
                      setPassword(pw);
                      setShowPassword(true);
                      setShowGenerator(false);
                    }}
                  />
                )}

                {/* Website / URL */}
                {permissions?.fields?.includes("websiteUrl") && (
                  <div>
                    <label htmlFor="cred-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Website / URL
                    </label>
                    <input
                      id="cred-url"
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="https://console.aws.amazon.com"
                    />
                  </div>
                )}

                {/* Environment */}
                {permissions?.environments?.length > 0 && permissions?.fields?.includes("environment") && (
                  <div>
                    <label htmlFor="cred-env" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Environment
                    </label>
                    <select
                      id="cred-env"
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select environment...</option>
                      {permissions.environments.map((env) => (
                        <option key={env.value} value={env.value}>{env.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Team */}
                {permissions?.fields?.includes("team") && (
                  <div>
                    <label htmlFor="cred-team" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Team / Owner {permissions.requiresTeamSelection && <span className="text-red-400">*</span>}
                    </label>
                    <select
                      id="cred-team"
                      value={team}
                      onChange={(e) => setTeam(e.target.value)}
                      required={permissions.requiresTeamSelection}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select team...</option>
                      {teams.map((t) => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Project */}
                {permissions?.fields?.includes("project") && (
                  <div>
                    <label htmlFor="cred-project" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Project {permissions.requiresProjectSelection && <span className="text-red-400">*</span>}
                    </label>
                    <input
                      id="cred-project"
                      type="text"
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      required={permissions.requiresProjectSelection}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="e.g. Project Alpha, Mobile App"
                    />
                  </div>
                )}

                {/* Access Level */}
                {permissions?.accessLevels?.length > 0 && permissions?.fields?.includes("accessLevel") && (
                  <div>
                    <label htmlFor="cred-access" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Access Level
                    </label>
                    <select
                      id="cred-access"
                      value={accessLevel}
                      onChange={(e) => setAccessLevel(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                    >
                      {permissions.accessLevels.map((al) => (
                        <option key={al.value} value={al.value}>{al.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Description */}
                {permissions?.fields?.includes("description") && (
                  <div>
                    <label htmlFor="cred-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Description
                    </label>
                    <textarea
                      id="cred-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                      placeholder="Optional description..."
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={isEditing ? onClose : () => setStep(1)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-vault-border text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-vault-dark transition-all"
                  >
                    {isEditing ? "Cancel" : "Back"}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Scanning…
                      </span>
                    ) : isEditing ? (
                      "Update"
                    ) : (
                      "Add Credential"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AddCredentialModal;
