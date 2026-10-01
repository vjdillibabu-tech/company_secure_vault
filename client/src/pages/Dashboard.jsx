import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import SidebarLayout from "../components/SidebarLayout";
import AddCredentialModal from "../components/AddCredentialModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import IdentityVerificationModal from "../components/IdentityVerificationModal";
import PasswordUpdateModal from "../components/PasswordUpdateModal";
import { getCategoryIcon, getRoleDisplay } from "../config/credentialConfig";

function Dashboard() {
  const { user, api } = useAuth();

  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCredential, setEditingCredential] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Verification modal states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationAction, setVerificationAction] = useState(null); // "reveal" or "update"
  const [pendingCredentialId, setPendingCredentialId] = useState(null);

  // Password update modal state
  const [showPasswordUpdateModal, setShowPasswordUpdateModal] = useState(false);
  const [credentialForUpdate, setCredentialForUpdate] = useState(null);

  // Revealed passwords — keyed by credential id
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [revealingId, setRevealingId] = useState(null);

  // Auto-hide timers for revealed passwords (30 seconds)
  const autoHideTimers = useRef({});
  // Countdown seconds for revealed passwords
  const [revealCountdowns, setRevealCountdowns] = useState({});
  const countdownIntervals = useRef({});

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const roleDisplay = getRoleDisplay(user?.role);

  const fetchCredentials = useCallback(async () => {
    try {
      setError("");
      const res = await api.get("/credentials");
      setCredentials(res.data.credentials);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load credentials.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(autoHideTimers.current).forEach(clearTimeout);
      Object.values(countdownIntervals.current).forEach(clearInterval);
    };
  }, []);

  // ──────────────────────────────────────────────
  // Reveal / hide password — OTP-based flow
  // ──────────────────────────────────────────────
  const handleReveal = async (id) => {
    if (revealedPasswords[id]) {
      // Toggle off — hide immediately
      clearAutoHideTimer(id);
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    // Open OTP verification modal
    setPendingCredentialId(id);
    setVerificationAction("reveal");
    setShowVerificationModal(true);
  };

  // Handle successful OTP verification — use reveal token to fetch password
  const handleVerificationSuccess = async (revealToken) => {
    if (verificationAction === "reveal" && pendingCredentialId) {
      setRevealingId(pendingCredentialId);
      try {
        const res = await api.get(`/auth/password-reveal/${pendingCredentialId}/reveal`, {
          headers: { "x-reveal-token": revealToken },
        });
        const credId = pendingCredentialId;
        setRevealedPasswords((prev) => ({
          ...prev,
          [credId]: res.data.password,
        }));

        // Start auto-hide countdown (30 seconds)
        startAutoHideTimer(credId);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to reveal password after verification.");
      } finally {
        setRevealingId(null);
      }
    } else if (verificationAction === "update" && pendingCredentialId) {
      // Open password update modal with verification token
      const credential = credentials.find(c => c._id === pendingCredentialId);
      if (credential) {
        setCredentialForUpdate({
          ...credential,
          verificationToken: revealToken,
        });
        setShowPasswordUpdateModal(true);
      }
    }

    // Reset verification state
    setPendingCredentialId(null);
    setVerificationAction(null);
  };

  // ──────────────────────────────────────────────
  // Auto-hide timer — hides password after 30 seconds
  // ──────────────────────────────────────────────
  const AUTO_HIDE_SECONDS = 30;

  const startAutoHideTimer = (credId) => {
    // Clear any existing timer
    clearAutoHideTimer(credId);

    // Set countdown
    setRevealCountdowns((prev) => ({ ...prev, [credId]: AUTO_HIDE_SECONDS }));

    // Start countdown interval
    countdownIntervals.current[credId] = setInterval(() => {
      setRevealCountdowns((prev) => {
        const newVal = (prev[credId] || 0) - 1;
        if (newVal <= 0) {
          clearInterval(countdownIntervals.current[credId]);
          delete countdownIntervals.current[credId];
          const { [credId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [credId]: newVal };
      });
    }, 1000);

    // Set timeout to hide password
    autoHideTimers.current[credId] = setTimeout(() => {
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[credId];
        return next;
      });
      delete autoHideTimers.current[credId];
    }, AUTO_HIDE_SECONDS * 1000);
  };

  const clearAutoHideTimer = (credId) => {
    if (autoHideTimers.current[credId]) {
      clearTimeout(autoHideTimers.current[credId]);
      delete autoHideTimers.current[credId];
    }
    if (countdownIntervals.current[credId]) {
      clearInterval(countdownIntervals.current[credId]);
      delete countdownIntervals.current[credId];
    }
    setRevealCountdowns((prev) => {
      const { [credId]: _, ...rest } = prev;
      return rest;
    });
  };

  // Copy to clipboard
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers handled silently
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/credentials/${deleteTarget._id}`);
      setDeleteTarget(null);
      fetchCredentials();
    } catch {
      setError("Failed to delete credential.");
    } finally {
      setDeleting(false);
    }
  };

  // Edit
  const handleEdit = (cred) => {
    setEditingCredential(cred);
    // Show verification modal before allowing edit
    setPendingCredentialId(cred._id);
    setVerificationAction("update");
    setShowVerificationModal(true);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingCredential(null);
  };

  const handlePasswordUpdated = (updatedCredential) => {
    // Update the credentials list with the updated credential
    setCredentials(prev => prev.map(c =>
      c._id === updatedCredential._id ? updatedCredential : c
    ));
    fetchCredentials(); // Refresh to get latest data
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Filter credentials
  const filteredCredentials = credentials.filter((cred) => {
    const matchesCategory = !categoryFilter || cred.category === categoryFilter;
    const matchesSearch = !searchQuery ||
      (cred.credentialName || cred.siteName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      cred.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Get unique categories from current credentials
  const activeCategories = [...new Set(credentials.map(c => c.category).filter(Boolean))];

  // Role description for header
  const getRoleDescription = () => {
    switch (user?.role) {
      case "super_admin":
        return "Full access — managing all company-wide credentials.";
      case "admin":
        return "Administrative access — managing authorized credentials.";
      case "manager":
        return "Team access — managing team credentials and resources.";
      case "developer":
        return "Development access — managing development credentials.";
      case "employee":
        return "Personal access — managing your work credentials.";
      default:
        return "Viewing your credentials.";
    }
  };

  // Check if user can delete (role-based)
  const canDelete = (cred) => {
    if (user?.role === "super_admin") return true;
    if (user?.role === "admin" && cred.addedByRole !== "super_admin") return true;
    if (user?.role === "manager") {
      if (["super_admin", "admin"].includes(cred.addedByRole)) return false;
      return cred.addedBy?._id === user?.id || cred.addedBy === user?.id;
    }
    return cred.addedBy?._id === user?.id || cred.addedBy === user?.id;
  };

  // Check if user can edit
  const canEdit = (cred) => {
    if (user?.role === "super_admin") return true;
    if (user?.role === "admin" && cred.addedByRole !== "super_admin") return true;
    if (user?.role === "manager") {
      if (["super_admin", "admin"].includes(cred.addedByRole)) return false;
      return true;
    }
    return cred.addedBy?._id === user?.id || cred.addedBy === user?.id;
  };

  return (
    <SidebarLayout>
      {/* ── Content ── */}
      <div className="px-6 lg:px-10 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleDisplay.gradientFrom} ${roleDisplay.gradientTo} flex items-center justify-center shadow-lg`}>
                <span className="text-lg text-white filter drop-shadow">{roleDisplay.icon}</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  Credential Vault
                </h1>
              </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {getRoleDescription()}
            </p>
          </div>
          <button
            onClick={() => {
              setEditingCredential(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Credential
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Credentials",
              value: credentials.length,
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              ),
              color: "primary",
            },
            {
              label: "Categories",
              value: activeCategories.length,
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              ),
              color: "violet",
            },
            {
              label: "Passwords Revealed",
              value: Object.keys(revealedPasswords).length,
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ),
              color: "amber",
            },
            {
              label: "Compromised",
              value: credentials.filter((c) => c.compromised).length,
              icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              color: credentials.filter((c) => c.compromised).length > 0 ? "red" : "emerald",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  stat.color === "primary"
                    ? "bg-primary-500/10 text-primary-500 dark:text-primary-400"
                    : stat.color === "violet"
                    ? "bg-violet-500/10 text-violet-500 dark:text-violet-400"
                    : stat.color === "amber"
                    ? "bg-amber-500/10 text-amber-500 dark:text-amber-400"
                    : stat.color === "red"
                    ? "bg-red-500/10 text-red-500 dark:text-red-400"
                    : "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                }`}
              >
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-bold capitalize text-gray-900 dark:text-gray-100">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search credentials..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
            />
          </div>
          {activeCategories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm appearance-none cursor-pointer min-w-[180px]"
            >
              <option value="">All Categories</option>
              {activeCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {getCategoryIcon(cat)} {cat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
            <button onClick={() => setError("")} className="ml-auto text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300">✕</button>
          </div>
        )}

        {/* ── Table ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredCredentials.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20 rounded-2xl border border-dashed border-gray-300 dark:border-vault-border">
            <svg className="w-14 h-14 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              {searchQuery || categoryFilter ? "No matching credentials" : "No credentials yet"}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 mb-6">
              {searchQuery || categoryFilter
                ? "Try adjusting your search or filter."
                : "Add your first credential to get started."}
            </p>
            {!searchQuery && !categoryFilter && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-500/20 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Credential
              </button>
            )}
          </div>
        ) : (
          /* Credentials table */
          <div className="rounded-2xl border border-gray-200 dark:border-vault-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-vault-border bg-gray-50 dark:bg-vault-card/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Credential</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Username</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Password</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Added By</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-vault-border">
                  {filteredCredentials.map((cred) => (
                    <tr
                      key={cred._id}
                      className="bg-white dark:bg-vault-card hover:bg-gray-50 dark:hover:bg-vault-border/20 transition-colors group"
                    >
                      {/* Credential Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            cred.compromised
                              ? "bg-gradient-to-br from-red-500/20 to-red-700/20 border border-red-500/20 text-red-500 dark:text-red-400"
                              : "bg-gradient-to-br from-primary-500/20 to-primary-700/20 border border-primary-500/10 text-primary-500 dark:text-primary-400"
                          }`}>
                            {getCategoryIcon(cred.category)}
                          </div>
                          <div>
                            <span className="font-medium text-gray-800 dark:text-gray-200 block">
                              {cred.credentialName || cred.siteName}
                            </span>
                            {cred.environment && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-500 dark:text-primary-400 font-medium uppercase">
                                {cred.environment}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-vault-dark text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-vault-border">
                          {getCategoryIcon(cred.category)}
                          <span className="truncate max-w-[100px]">
                            {cred.category?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        </span>
                      </td>

                      {/* Breach Status */}
                      <td className="px-6 py-4">
                        {cred.compromised ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20"
                            title={`Found in ${cred.breachCount?.toLocaleString()} data breaches`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Breached{cred.breachCount ? ` (${cred.breachCount.toLocaleString()}×)` : ""}
                          </span>
                        ) : cred.breachCheckFailed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Unknown
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Safe
                          </span>
                        )}
                      </td>

                      {/* Username */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 dark:text-gray-300 text-sm font-mono">{cred.username}</span>
                          <button
                            onClick={() => handleCopy(cred.username)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 dark:hover:bg-vault-border/50 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
                            title="Copy username"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>

                      {/* Password */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {revealedPasswords[cred._id] ? (
                            <>
                              <span className="text-emerald-600 dark:text-emerald-400 text-sm font-mono bg-emerald-500/5 px-2 py-1 rounded-lg border border-emerald-500/10">
                                {revealedPasswords[cred._id]}
                              </span>
                              <button
                                onClick={() => handleCopy(revealedPasswords[cred._id])}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-vault-border/50 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
                                title="Copy password"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                              {/* Auto-hide countdown badge */}
                              {revealCountdowns[cred._id] && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                  revealCountdowns[cred._id] <= 10
                                    ? "bg-red-500/10 text-red-500 dark:text-red-400"
                                    : "bg-gray-100 dark:bg-vault-dark text-gray-500 dark:text-gray-400"
                                }`}>
                                  {revealCountdowns[cred._id]}s
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 tracking-widest text-lg">••••••••</span>
                          )}
                          <button
                            onClick={() => handleReveal(cred._id)}
                            disabled={revealingId === cred._id}
                            className={`p-1.5 rounded-lg border transition-all duration-200 ${
                              revealedPasswords[cred._id]
                                ? "border-emerald-500/20 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/10"
                                : "border-gray-200 dark:border-vault-border text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:border-primary-500/30"
                            } disabled:opacity-50`}
                            title={revealedPasswords[cred._id] ? "Hide password" : "Reveal password"}
                          >
                            {revealingId === cred._id ? (
                              <span className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin block" />
                            ) : revealedPasswords[cred._id] ? (
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
                      </td>

                      {/* Added By */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{cred.addedBy?.name || "Unknown"}</span>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-400 dark:text-gray-500">{formatDate(cred.createdAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit(cred) && (
                            <button
                              onClick={() => handleEdit(cred)}
                              className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-primary-500/10 transition-all"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {canDelete(cred) && (
                            <button
                              onClick={() => setDeleteTarget(cred)}
                              className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-all"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AddCredentialModal
        key={editingCredential?._id || "add"}
        isOpen={showAddModal}
        onClose={handleModalClose}
        onSaved={fetchCredentials}
        editingCredential={editingCredential}
      />

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        credentialName={deleteTarget?.credentialName || deleteTarget?.siteName}
        deleting={deleting}
      />

      <IdentityVerificationModal
        isOpen={showVerificationModal}
        onClose={() => {
          setShowVerificationModal(false);
          setPendingCredentialId(null);
          setVerificationAction(null);
        }}
        onVerificationSuccess={handleVerificationSuccess}
        credentialId={pendingCredentialId}
      />

      <PasswordUpdateModal
        isOpen={showPasswordUpdateModal}
        onClose={() => setShowPasswordUpdateModal(false)}
        credential={credentialForUpdate}
        onPasswordUpdated={handlePasswordUpdated}
      />
    </SidebarLayout>
  );
}

export default Dashboard;
