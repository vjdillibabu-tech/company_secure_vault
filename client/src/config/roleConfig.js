/**
 * ────────────────────────────────────────────────────────────────
 * Role Configuration — Single Source of Truth
 * ────────────────────────────────────────────────────────────────
 * Every role in the Company Password Vault is defined here.
 * To add a new role, simply append a new entry to the ROLES array.
 * The registration page, role info card, and all role-related UIs
 * consume this config — no rewriting required.
 * ────────────────────────────────────────────────────────────────
 */

const ROLES = [
  {
    value: "super_admin",
    label: "Super Admin",
    icon: "👑",
    accessLevel: "FULL",
    accessLevelLabel: "Full Access",
    badgeColor: "from-amber-500 to-orange-600",
    badgeBg: "bg-amber-500/10 border-amber-500/30 text-amber-600",
    accentColor: "#f59e0b",
    responsibility: "Full company security & system control.",
    vaultAccess: "Full access to the entire company vault.",
    canDo: [
      "Manage all users",
      "Create/edit/delete roles",
      "Manage Admins",
      "Manage Managers",
      "Manage vault permissions",
      "View all credentials",
      "Manage teams",
      "View complete audit logs",
      "Approve emergency access",
      "Revoke access",
      "Manage security policies",
    ],
    cannotDo: ["Nothing — full access within the company vault"],
    dashboardPath: "/dashboard/super-admin",
    dashboardLabel: "Super Admin Dashboard",
  },
  {
    value: "admin",
    label: "Admin",
    icon: "🛡️",
    accessLevel: "HIGH",
    accessLevelLabel: "High Access",
    badgeColor: "from-blue-500 to-indigo-600",
    badgeBg: "bg-blue-500/10 border-blue-500/30 text-blue-600",
    accentColor: "#3b82f6",
    responsibility: "Users, teams & permissions management.",
    vaultAccess: "High-level administrative access.",
    canDo: [
      "Manage users",
      "Manage Manager and Employee access",
      "Create and manage vault resources",
      "View approved credentials",
      "Manage permissions",
      "View audit logs",
      "Approve access requests",
      "Revoke access",
    ],
    cannotDo: [
      "Modify Super Admin",
      "Change Super Admin permissions",
      "Access restricted Super Admin settings",
    ],
    dashboardPath: "/dashboard/admin",
    dashboardLabel: "Admin Dashboard",
  },
  {
    value: "manager",
    label: "Manager",
    icon: "👨‍💼",
    accessLevel: "TEAM",
    accessLevelLabel: "Team Access",
    badgeColor: "from-emerald-500 to-teal-600",
    badgeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600",
    accentColor: "#10b981",
    responsibility: "Team members & access approvals.",
    vaultAccess: "Team-based access.",
    canDo: [
      "Manage assigned team members",
      "Approve Employee access requests",
      "View credentials assigned to their team",
      "Request temporary access",
      "Review team activity",
      "View relevant audit logs",
    ],
    cannotDo: [
      "Manage Admins",
      "Manage Super Admins",
      "Modify company-wide security settings",
      "Access credentials outside their assigned team",
    ],
    dashboardPath: "/dashboard/manager",
    dashboardLabel: "Manager Dashboard",
  },
  {
    value: "developer",
    label: "Developer",
    icon: "💻",
    accessLevel: "ASSIGNED",
    accessLevelLabel: "Assigned Access",
    badgeColor: "from-violet-500 to-purple-600",
    badgeBg: "bg-violet-500/10 border-violet-500/30 text-violet-600",
    accentColor: "#8b5cf6",
    responsibility: "Development credentials & resources.",
    vaultAccess: "Development-related credentials only.",
    canDo: [
      "Access assigned development credentials",
      "Access development API keys",
      "Access development database credentials",
      "Request temporary production access",
      "Request emergency access when required",
    ],
    cannotDo: [
      "Manage users",
      "Manage roles",
      "Modify company-wide permissions",
      "Access credentials without permission",
    ],
    dashboardPath: "/dashboard/developer",
    dashboardLabel: "Developer Dashboard",
  },
  {
    value: "employee",
    label: "Employee",
    icon: "👤",
    accessLevel: "LIMITED",
    accessLevelLabel: "Limited Access",
    badgeColor: "from-slate-500 to-gray-600",
    badgeBg: "bg-slate-500/10 border-slate-500/30 text-slate-600",
    accentColor: "#64748b",
    responsibility: "Daily work-related credentials.",
    vaultAccess: "Limited, permission-based access.",
    canDo: [
      "View credentials explicitly assigned to them",
      "Request access to additional resources",
      "Request temporary access",
      "View their own access history",
    ],
    cannotDo: [
      "Manage users",
      "Manage roles",
      "Approve other users",
      "Access unassigned credentials",
      "View company-wide audit logs",
    ],
    dashboardPath: "/dashboard/employee",
    dashboardLabel: "Employee Dashboard",
  },
];

/**
 * Get a role config by its value (e.g. "super_admin")
 */
export const getRoleByValue = (value) => ROLES.find((r) => r.value === value) || null;

/**
 * Get all role values as a flat array (for validation)
 */
export const ROLE_VALUES = ROLES.map((r) => r.value);

export default ROLES;
