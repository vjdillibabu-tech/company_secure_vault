/**
 * ────────────────────────────────────────────────────────────────
 * Role Permissions — Backend Source of Truth
 * ────────────────────────────────────────────────────────────────
 * Defines what each role can access: credential categories,
 * access levels, environments, and form fields.
 * The frontend fetches this config from the API so that UI
 * and backend stay in sync — no client-side overrides.
 * ────────────────────────────────────────────────────────────────
 */

const ROLE_PERMISSIONS = {
  super_admin: {
    categories: [
      { value: "cloud_aws", label: "Cloud / AWS", icon: "☁️" },
      { value: "database", label: "Database", icon: "🗄️" },
      { value: "server_infrastructure", label: "Server / Infrastructure", icon: "🖥️" },
      { value: "admin_account", label: "Admin Account", icon: "🔐" },
      { value: "domain_dns", label: "Domain / DNS", icon: "🌐" },
      { value: "api_keys", label: "API Keys", icon: "🔑" },
      { value: "development", label: "Development", icon: "💻" },
      { value: "production", label: "Production", icon: "🚀" },
      { value: "company_email", label: "Company Email", icon: "📧" },
      { value: "saas_company_tools", label: "SaaS / Company Tools", icon: "🛠️" },
      { value: "payment_billing", label: "Payment / Billing", icon: "💳" },
      { value: "security_tools", label: "Security Tools", icon: "🔒" },
      { value: "backup", label: "Backup", icon: "📦" },
      { value: "internal_applications", label: "Internal Applications", icon: "🏢" },
      { value: "other", label: "Other", icon: "📱" },
    ],
    accessLevels: [
      { value: "private", label: "Private" },
      { value: "team", label: "Team" },
      { value: "department", label: "Department" },
      { value: "company", label: "Company" },
      { value: "restricted", label: "Restricted" },
    ],
    environments: [
      { value: "development", label: "Development" },
      { value: "testing", label: "Testing" },
      { value: "staging", label: "Staging" },
      { value: "production", label: "Production" },
    ],
    fields: [
      "credentialName", "username", "password", "websiteUrl",
      "category", "environment", "description", "team", "accessLevel",
    ],
    canCreateProduction: true,
    canManageAllCredentials: true,
    requiresTeamSelection: false,
    requiresProjectSelection: false,
  },

  admin: {
    categories: [
      { value: "saas_company_tools", label: "SaaS / Company Tools", icon: "🛠️" },
      { value: "team_management_tools", label: "Team Management Tools", icon: "👥" },
      { value: "company_applications", label: "Company Applications", icon: "📧" },
      { value: "database", label: "Database — Assigned", icon: "🗄️" },
      { value: "server_infrastructure", label: "Server / Infrastructure — Assigned", icon: "🖥️" },
      { value: "api_keys", label: "API Keys — Assigned", icon: "🔑" },
      { value: "domain_dns", label: "Domain / DNS", icon: "🌐" },
      { value: "billing_subscription", label: "Billing / Subscription Tools", icon: "💳" },
      { value: "security_tools", label: "Security Tools", icon: "🔒" },
      { value: "internal_applications", label: "Internal Applications", icon: "🏢" },
    ],
    accessLevels: [
      { value: "private", label: "Private" },
      { value: "team", label: "Team" },
      { value: "department", label: "Department" },
      { value: "restricted", label: "Restricted" },
    ],
    environments: [
      { value: "development", label: "Development" },
      { value: "testing", label: "Testing" },
      { value: "staging", label: "Staging" },
      { value: "production", label: "Production" },
    ],
    fields: [
      "credentialName", "username", "password", "websiteUrl",
      "category", "environment", "team", "description", "accessLevel",
    ],
    canCreateProduction: true,
    canManageAllCredentials: false,
    requiresTeamSelection: false,
    requiresProjectSelection: false,
  },

  manager: {
    categories: [
      { value: "project_management", label: "Project Management Tools", icon: "📊" },
      { value: "development_tools", label: "Development Tools", icon: "💻" },
      { value: "testing_staging", label: "Testing / Staging Tools", icon: "🧪" },
      { value: "team_email", label: "Team Email / Shared Accounts", icon: "📧" },
      { value: "team_saas", label: "Team SaaS Tools", icon: "🛠️" },
      { value: "team_api_keys", label: "Team API Keys", icon: "🔑" },
      { value: "internal_team_apps", label: "Internal Team Applications", icon: "🏢" },
      { value: "shared_project_resources", label: "Shared Project Resources", icon: "📁" },
      { value: "assigned_team_database", label: "Assigned Team Database", icon: "🗄️" },
      { value: "assigned_team_services", label: "Assigned Team Services", icon: "🌐" },
    ],
    accessLevels: [
      { value: "manager_only", label: "Manager Only" },
      { value: "team_members", label: "Team Members" },
      { value: "selected_employees", label: "Selected Employees" },
    ],
    environments: [
      { value: "development", label: "Development" },
      { value: "testing", label: "Testing" },
      { value: "staging", label: "Staging" },
    ],
    fields: [
      "credentialName", "username", "password", "websiteUrl",
      "category", "team", "project", "environment", "description",
    ],
    canCreateProduction: false,
    canManageAllCredentials: false,
    requiresTeamSelection: true,
    requiresProjectSelection: true,
  },

  developer: {
    categories: [
      { value: "github_gitlab", label: "GitHub / GitLab", icon: "🐙" },
      { value: "api_keys", label: "API Keys", icon: "🔑" },
      { value: "development_database", label: "Development Database", icon: "🗄️" },
      { value: "testing_database", label: "Testing Database", icon: "🧪" },
      { value: "staging_server", label: "Staging Server", icon: "🚀" },
      { value: "development_server", label: "Development Server", icon: "💻" },
      { value: "cloud_dev_account", label: "Cloud Development Account", icon: "☁️" },
      { value: "package_registry", label: "Package Registry", icon: "📦" },
      { value: "development_tools", label: "Development Tools", icon: "🛠️" },
      { value: "ai_dev_apis", label: "AI / Development APIs", icon: "🤖" },
      { value: "internal_dev_app", label: "Internal Development Application", icon: "🏢" },
    ],
    accessLevels: [
      { value: "private", label: "Private" },
      { value: "team", label: "Team" },
    ],
    environments: [
      { value: "development", label: "Development" },
      { value: "testing", label: "Testing" },
      { value: "staging", label: "Staging" },
    ],
    fields: [
      "credentialName", "username", "password", "websiteUrl",
      "category", "environment", "project", "team", "description",
    ],
    canCreateProduction: false,
    canManageAllCredentials: false,
    requiresTeamSelection: false,
    requiresProjectSelection: false,
  },

  employee: {
    categories: [
      { value: "company_email", label: "Company Email", icon: "📧" },
      { value: "internal_applications", label: "Internal Applications", icon: "🏢" },
      { value: "work_project_tools", label: "Work / Project Tools", icon: "📊" },
      { value: "productivity_tools", label: "Productivity Tools", icon: "📋" },
      { value: "assigned_saas_tools", label: "Assigned SaaS Tools", icon: "🛠️" },
      { value: "shared_work_resources", label: "Shared Work Resources", icon: "📁" },
      { value: "assigned_websites", label: "Assigned Websites", icon: "🌐" },
      { value: "personal_work_api_key", label: "Personal Work API Key", icon: "🔑" },
    ],
    accessLevels: [
      { value: "private", label: "Private" },
      { value: "shared_with_team", label: "Shared with Team" },
    ],
    environments: [],
    fields: [
      "credentialName", "username", "password", "websiteUrl",
      "category", "project", "description",
    ],
    canCreateProduction: false,
    canManageAllCredentials: false,
    requiresTeamSelection: false,
    requiresProjectSelection: false,
    // Categories employee CANNOT create (for validation)
    restrictedCategories: [
      "production", "server_infrastructure", "database",
      "admin_account", "cloud_aws", "security_tools",
    ],
  },
};

/**
 * Get allowed category values for a given role
 */
function getAllowedCategories(role) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  return perms.categories.map((c) => c.value);
}

/**
 * Get allowed access level values for a given role
 */
function getAllowedAccessLevels(role) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  return perms.accessLevels.map((a) => a.value);
}

/**
 * Check if a role can create a credential in a given category
 */
function canCreateInCategory(role, category) {
  const allowed = getAllowedCategories(role);
  return allowed.includes(category);
}

/**
 * Check if a role can create production credentials
 */
function canCreateProductionCredential(role) {
  const perms = ROLE_PERMISSIONS[role];
  return perms?.canCreateProduction ?? false;
}

module.exports = {
  ROLE_PERMISSIONS,
  getAllowedCategories,
  getAllowedAccessLevels,
  canCreateInCategory,
  canCreateProductionCredential,
};
