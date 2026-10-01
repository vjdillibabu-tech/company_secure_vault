/**
 * ────────────────────────────────────────────────────────────────
 * Credential Config — Role-based credential categories & fields
 * ────────────────────────────────────────────────────────────────
 * This file provides UI-facing helpers that work alongside the
 * backend rolePermissions. The backend is the source of truth;
 * this file only supplies icons, colors, and labels for the UI.
 * ────────────────────────────────────────────────────────────────
 */

// Dashboard redirect paths per role
export const ROLE_DASHBOARD_PATHS = {
  super_admin: "/dashboard/super-admin",
  admin: "/dashboard/admin",
  manager: "/dashboard/manager",
  developer: "/dashboard/developer",
  employee: "/dashboard/employee",
};

/**
 * Get the dashboard redirect path for a given role.
 * Falls back to /dashboard if role is unknown.
 */
export function getDashboardPath(role) {
  return ROLE_DASHBOARD_PATHS[role] || "/dashboard";
}

// Category icon map (for display in the credentials table)
export const CATEGORY_ICONS = {
  cloud_aws: "☁️",
  database: "🗄️",
  server_infrastructure: "🖥️",
  admin_account: "🔐",
  domain_dns: "🌐",
  api_keys: "🔑",
  development: "💻",
  production: "🚀",
  company_email: "📧",
  saas_company_tools: "🛠️",
  payment_billing: "💳",
  security_tools: "🔒",
  backup: "📦",
  internal_applications: "🏢",
  other: "📱",
  team_management_tools: "👥",
  company_applications: "📧",
  billing_subscription: "💳",
  project_management: "📊",
  development_tools: "💻",
  testing_staging: "🧪",
  team_email: "📧",
  team_saas: "🛠️",
  team_api_keys: "🔑",
  internal_team_apps: "🏢",
  shared_project_resources: "📁",
  assigned_team_database: "🗄️",
  assigned_team_services: "🌐",
  github_gitlab: "🐙",
  development_database: "🗄️",
  testing_database: "🧪",
  staging_server: "🚀",
  development_server: "💻",
  cloud_dev_account: "☁️",
  package_registry: "📦",
  ai_dev_apis: "🤖",
  internal_dev_app: "🏢",
  work_project_tools: "📊",
  productivity_tools: "📋",
  assigned_saas_tools: "🛠️",
  shared_work_resources: "📁",
  assigned_websites: "🌐",
  personal_work_api_key: "🔑",
};

// Category gradient colors for the selection cards
export const CATEGORY_COLORS = {
  cloud_aws: "from-sky-500/20 to-cyan-500/20 border-sky-500/30 hover:border-sky-400",
  database: "from-amber-500/20 to-orange-500/20 border-amber-500/30 hover:border-amber-400",
  server_infrastructure: "from-slate-500/20 to-gray-500/20 border-slate-500/30 hover:border-slate-400",
  admin_account: "from-red-500/20 to-rose-500/20 border-red-500/30 hover:border-red-400",
  domain_dns: "from-green-500/20 to-emerald-500/20 border-green-500/30 hover:border-green-400",
  api_keys: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30 hover:border-yellow-400",
  development: "from-violet-500/20 to-purple-500/20 border-violet-500/30 hover:border-violet-400",
  production: "from-red-500/20 to-pink-500/20 border-red-500/30 hover:border-red-400",
  company_email: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 hover:border-blue-400",
  saas_company_tools: "from-teal-500/20 to-cyan-500/20 border-teal-500/30 hover:border-teal-400",
  payment_billing: "from-emerald-500/20 to-green-500/20 border-emerald-500/30 hover:border-emerald-400",
  security_tools: "from-red-500/20 to-orange-500/20 border-red-500/30 hover:border-red-400",
  backup: "from-indigo-500/20 to-blue-500/20 border-indigo-500/30 hover:border-indigo-400",
  internal_applications: "from-slate-500/20 to-zinc-500/20 border-slate-500/30 hover:border-slate-400",
  other: "from-gray-500/20 to-slate-500/20 border-gray-500/30 hover:border-gray-400",
  // Admin categories
  team_management_tools: "from-teal-500/20 to-emerald-500/20 border-teal-500/30 hover:border-teal-400",
  company_applications: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 hover:border-blue-400",
  billing_subscription: "from-emerald-500/20 to-green-500/20 border-emerald-500/30 hover:border-emerald-400",
  // Manager categories
  project_management: "from-orange-500/20 to-amber-500/20 border-orange-500/30 hover:border-orange-400",
  development_tools: "from-violet-500/20 to-purple-500/20 border-violet-500/30 hover:border-violet-400",
  testing_staging: "from-lime-500/20 to-green-500/20 border-lime-500/30 hover:border-lime-400",
  team_email: "from-blue-500/20 to-sky-500/20 border-blue-500/30 hover:border-blue-400",
  team_saas: "from-teal-500/20 to-cyan-500/20 border-teal-500/30 hover:border-teal-400",
  team_api_keys: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30 hover:border-yellow-400",
  internal_team_apps: "from-slate-500/20 to-zinc-500/20 border-slate-500/30 hover:border-slate-400",
  shared_project_resources: "from-indigo-500/20 to-violet-500/20 border-indigo-500/30 hover:border-indigo-400",
  assigned_team_database: "from-amber-500/20 to-orange-500/20 border-amber-500/30 hover:border-amber-400",
  assigned_team_services: "from-green-500/20 to-emerald-500/20 border-green-500/30 hover:border-green-400",
  // Developer categories
  github_gitlab: "from-gray-500/20 to-zinc-500/20 border-gray-500/30 hover:border-gray-400",
  development_database: "from-amber-500/20 to-yellow-500/20 border-amber-500/30 hover:border-amber-400",
  testing_database: "from-lime-500/20 to-green-500/20 border-lime-500/30 hover:border-lime-400",
  staging_server: "from-orange-500/20 to-red-500/20 border-orange-500/30 hover:border-orange-400",
  development_server: "from-violet-500/20 to-indigo-500/20 border-violet-500/30 hover:border-violet-400",
  cloud_dev_account: "from-sky-500/20 to-blue-500/20 border-sky-500/30 hover:border-sky-400",
  package_registry: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30 hover:border-indigo-400",
  ai_dev_apis: "from-pink-500/20 to-rose-500/20 border-pink-500/30 hover:border-pink-400",
  internal_dev_app: "from-slate-500/20 to-gray-500/20 border-slate-500/30 hover:border-slate-400",
  // Employee categories
  work_project_tools: "from-orange-500/20 to-amber-500/20 border-orange-500/30 hover:border-orange-400",
  productivity_tools: "from-teal-500/20 to-cyan-500/20 border-teal-500/30 hover:border-teal-400",
  assigned_saas_tools: "from-violet-500/20 to-purple-500/20 border-violet-500/30 hover:border-violet-400",
  shared_work_resources: "from-indigo-500/20 to-blue-500/20 border-indigo-500/30 hover:border-indigo-400",
  assigned_websites: "from-green-500/20 to-emerald-500/20 border-green-500/30 hover:border-green-400",
  personal_work_api_key: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30 hover:border-yellow-400",
};

/**
 * Get the icon for a category value, with fallback
 */
export function getCategoryIcon(categoryValue) {
  return CATEGORY_ICONS[categoryValue] || "📁";
}

/**
 * Get the gradient color classes for a category card
 */
export function getCategoryColor(categoryValue) {
  return CATEGORY_COLORS[categoryValue] || "from-gray-500/20 to-slate-500/20 border-gray-500/30 hover:border-gray-400";
}

// Role display configs
export const ROLE_DISPLAY = {
  super_admin: {
    label: "Super Admin",
    icon: "👑",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    gradientFrom: "from-amber-500",
    gradientTo: "to-orange-600",
  },
  admin: {
    label: "Admin",
    icon: "🛡️",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    gradientFrom: "from-blue-500",
    gradientTo: "to-indigo-600",
  },
  manager: {
    label: "Manager",
    icon: "👨‍💼",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    gradientFrom: "from-emerald-500",
    gradientTo: "to-teal-600",
  },
  developer: {
    label: "Developer",
    icon: "💻",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    gradientFrom: "from-violet-500",
    gradientTo: "to-purple-600",
  },
  employee: {
    label: "Employee",
    icon: "👤",
    color: "text-slate-500",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/20",
    gradientFrom: "from-slate-500",
    gradientTo: "to-gray-600",
  },
};

export function getRoleDisplay(role) {
  return ROLE_DISPLAY[role] || ROLE_DISPLAY.employee;
}
