import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import SidebarLayout from "../components/SidebarLayout";

const ACTION_LABELS = {
  CREATE_CREDENTIAL: { label: "Created Credential", color: "emerald", icon: "+" },
  VIEW_CREDENTIAL: { label: "Viewed Password", color: "primary", icon: "👁" },
  UPDATE_CREDENTIAL: { label: "Updated Credential", color: "amber", icon: "✎" },
  DELETE_CREDENTIAL: { label: "Deleted Credential", color: "red", icon: "✕" },
  SHARE_CREDENTIAL: { label: "Shared Credential", color: "purple", icon: "↗" },
  REGISTER: { label: "User Registered", color: "sky", icon: "+" },
  LOGIN: { label: "User Login", color: "gray", icon: "→" },
  LOGOUT: { label: "User Logout", color: "gray", icon: "←" },
  CREATE_TEAM: { label: "Created Team", color: "indigo", icon: "+" },
  UPDATE_TEAM: { label: "Updated Team", color: "indigo", icon: "✎" },
  ADD_MEMBER: { label: "Added Member", color: "teal", icon: "+" },
  REMOVE_MEMBER: { label: "Removed Member", color: "orange", icon: "−" },
  PROFILE_UPDATE: { label: "Profile Updated", color: "cyan", icon: "✎" },
  PASSWORD_CHANGE: { label: "Password Changed", color: "rose", icon: "🔑" },
};

const ACTION_COLORS = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  primary: "bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  gray: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

function AuditLogPage() {
  const { api, user } = useAuth();

  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterUserId, setFilterUserId] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", 25);
      if (filterUserId) params.set("userId", filterUserId);
      if (filterAction) params.set("action", filterAction);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await api.get(`/audit-logs?${params.toString()}`);
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [api, page, filterUserId, filterAction, startDate, endDate]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/audit-logs/users");
      setUsers(res.data.users);
    } catch {
      // Silently fail — filter dropdown will just be empty
    }
  }, [api]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterUserId, filterAction, startDate, endDate]);

  const formatTimestamp = (ts) => {
    const date = new Date(ts);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getRelativeTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const clearFilters = () => {
    setFilterUserId("");
    setFilterAction("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const hasFilters = filterUserId || filterAction || startDate || endDate;

  return (
    <SidebarLayout>
      <div className="px-6 lg:px-10 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-gray-100">Audit Log</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Chronological record of all actions across the organization. Admin access only.
          </p>
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </h2>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* User filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">User</label>
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Action filter */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Actions</option>
                {Object.entries(ACTION_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Start date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* End date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {pagination.total} {pagination.total === 1 ? "entry" : "entries"}
            {hasFilters && " (filtered)"}
          </p>
        </div>

        {/* Log table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-gray-300 dark:border-vault-border">
            <svg className="w-14 h-14 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No audit logs found</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              {hasFilters ? "Try adjusting your filters." : "Actions will be logged here as they occur."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-vault-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-vault-border bg-gray-50 dark:bg-vault-card/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-vault-border">
                  {logs.map((log) => {
                    const actionMeta = ACTION_LABELS[log.action] || {
                      label: log.action,
                      color: "gray",
                      icon: "•",
                    };
                    const colorClass = ACTION_COLORS[actionMeta.color] || ACTION_COLORS.gray;

                    return (
                      <tr
                        key={log._id}
                        className="bg-white dark:bg-vault-card hover:bg-gray-50 dark:hover:bg-vault-border/20 transition-colors"
                      >
                        {/* Timestamp */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm text-gray-700 dark:text-gray-200">{formatTimestamp(log.timestamp)}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{getRelativeTime(log.timestamp)}</p>
                          </div>
                        </td>

                        {/* User */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-700/20 border border-primary-500/10 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-400">
                              {log.userId?.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                {log.userId?.name || "Unknown User"}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{log.userId?.email || ""}</p>
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${colorClass}`}
                          >
                            <span className="text-[10px]">{actionMeta.icon}</span>
                            {actionMeta.label}
                          </span>
                        </td>

                        {/* Target */}
                        <td className="px-6 py-4">
                          {log.credentialId ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-300">
                                {log.credentialId.siteName || "Deleted credential"}
                              </span>
                              {log.credentialId.username && (
                                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                  ({log.credentialId.username})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-vault-border bg-gray-50 dark:bg-vault-card/50">
                <p className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-vault-border text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page >= pagination.pages}
                    className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-vault-border text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

export default AuditLogPage;
