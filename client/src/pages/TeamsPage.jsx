import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import SidebarLayout from "../components/SidebarLayout";

function TeamsPage() {
  const { api } = useAuth();

  const [teams, setTeams] = useState([]);
  const [unassignedUsers, setUnassignedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Create team form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Assign user state — keyed by teamId
  const [assignDropdowns, setAssignDropdowns] = useState({});
  const [assigningTo, setAssigningTo] = useState(null);

  // Remove member state
  const [removingMember, setRemovingMember] = useState(null);

  // ── Fetch data ──
  const fetchTeams = useCallback(async () => {
    try {
      setError("");
      const res = await api.get("/teams");
      setTeams(res.data.teams);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load teams.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchUnassignedUsers = useCallback(async () => {
    try {
      const res = await api.get("/teams/unassigned-users");
      setUnassignedUsers(res.data.users);
    } catch {
      // Silently fail — dropdown will just be empty
    }
  }, [api]);

  useEffect(() => {
    fetchTeams();
    fetchUnassignedUsers();
  }, [fetchTeams, fetchUnassignedUsers]);

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // ── Create team ──
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreatingTeam(true);
    setError("");

    try {
      await api.post("/teams", { name: newTeamName.trim() });
      setNewTeamName("");
      setShowCreateForm(false);
      setSuccessMessage("Team created successfully.");
      fetchTeams();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create team.");
    } finally {
      setCreatingTeam(false);
    }
  };

  // ── Assign user to team ──
  const handleAssignUser = async (teamId) => {
    const userId = assignDropdowns[teamId];
    if (!userId) return;

    setAssigningTo(teamId);
    setError("");

    try {
      const res = await api.post(`/teams/${teamId}/members`, { userId });
      setSuccessMessage(res.data.message || "User assigned to team.");
      setAssignDropdowns((prev) => ({ ...prev, [teamId]: "" }));
      fetchTeams();
      fetchUnassignedUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to assign user.");
    } finally {
      setAssigningTo(null);
    }
  };

  // ── Remove member from team ──
  const handleRemoveMember = async (teamId, userId, userName) => {
    setRemovingMember(`${teamId}-${userId}`);
    setError("");

    try {
      await api.delete(`/teams/${teamId}/members/${userId}`);
      setSuccessMessage(`${userName} removed from team.`);
      fetchTeams();
      fetchUnassignedUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove member.");
    } finally {
      setRemovingMember(null);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <SidebarLayout>
      <div className="px-6 lg:px-10 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-gray-100">
              Teams
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Manage teams and assign members. Admin access only.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 whitespace-nowrap"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Team
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            {
              label: "Total Teams",
              value: teams.length,
              icon: (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              ),
              color: "primary",
            },
            {
              label: "Total Members",
              value: teams.reduce((sum, t) => sum + (t.members?.length || 0), 0),
              icon: (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              ),
              color: "emerald",
            },
            {
              label: "Unassigned Users",
              value: unassignedUsers.length,
              icon: (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
              ),
              color: unassignedUsers.length > 0 ? "amber" : "emerald",
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
                    : stat.color === "amber"
                    ? "bg-amber-500/10 text-amber-500 dark:text-amber-400"
                    : "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                }`}
              >
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-bold capitalize text-gray-900 dark:text-gray-100">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-3">
            <svg
              className="w-5 h-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {successMessage}
            <button
              onClick={() => setSuccessMessage("")}
              className="ml-auto text-emerald-500 dark:text-emerald-400 hover:text-emerald-400 dark:hover:text-emerald-300"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
            <svg
              className="w-5 h-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Create Team Form ── */}
        {showCreateForm && (
          <div className="mb-8 rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create New Team
            </h2>
            <form onSubmit={handleCreateTeam} className="flex gap-3">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                required
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g. Engineering, Marketing, Design"
              />
              <button
                type="submit"
                disabled={creatingTeam || !newTeamName.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100 whitespace-nowrap"
              >
                {creatingTeam ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating…
                  </span>
                ) : (
                  "Create"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTeamName("");
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-vault-border text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-vault-dark transition-all"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* ── Teams List ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : teams.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20 rounded-2xl border border-dashed border-gray-300 dark:border-vault-border">
            <svg
              className="w-14 h-14 mx-auto text-gray-400 dark:text-gray-600 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              No teams yet
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 mb-6">
              Create your first team to start organizing credentials.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-500/20 transition-all"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Team
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {teams.map((team) => (
              <div
                key={team._id}
                className="rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border overflow-hidden"
              >
                {/* Team header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-vault-border">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-700/20 border border-primary-500/10 flex items-center justify-center text-lg font-bold text-primary-600 dark:text-primary-400">
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {team.name}
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Created {formatDate(team.createdAt)} ·{" "}
                        {team.members?.length || 0}{" "}
                        {team.members?.length === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>

                  {/* Assign user dropdown */}
                  {unassignedUsers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={assignDropdowns[team._id] || ""}
                        onChange={(e) =>
                          setAssignDropdowns((prev) => ({
                            ...prev,
                            [team._id]: e.target.value,
                          }))
                        }
                        className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Assign user…</option>
                        {unassignedUsers.map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssignUser(team._id)}
                        disabled={
                          !assignDropdowns[team._id] ||
                          assigningTo === team._id
                        }
                        className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-sm font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {assigningTo === team._id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            Adding…
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                              />
                            </svg>
                            Add
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Members table */}
                {team.members && team.members.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-vault-border bg-gray-50 dark:bg-vault-card/50">
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Member
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-vault-border">
                        {team.members.map((member) => (
                          <tr
                            key={member._id}
                            className="bg-white dark:bg-vault-card hover:bg-gray-50 dark:hover:bg-vault-border/20 transition-colors group"
                          >
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-700/20 border border-primary-500/10 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-400">
                                  {member.name?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                  {member.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-3.5">
                              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                {member.email}
                              </span>
                            </td>
                            <td className="px-6 py-3.5">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${
                                  member.role === "admin"
                                    ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20"
                                    : member.role === "manager"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    : "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20"
                                }`}
                              >
                                {member.role}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <button
                                onClick={() =>
                                  handleRemoveMember(
                                    team._id,
                                    member._id,
                                    member.name
                                  )
                                }
                                disabled={
                                  removingMember ===
                                  `${team._id}-${member._id}`
                                }
                                className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 dark:text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all disabled:opacity-50"
                              >
                                {removingMember ===
                                `${team._id}-${member._id}` ? (
                                  <span className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
                                    />
                                  </svg>
                                )}
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center">
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      No members yet — use the dropdown above to assign users.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}

export default TeamsPage;
