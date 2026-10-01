import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getDashboardPath, getRoleDisplay } from "../config/credentialConfig";

// Role badge colors
const ROLE_COLORS = {
  super_admin: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  admin: "bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20",
  manager: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  developer: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  employee: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
};

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  developer: "Developer",
  employee: "Employee",
};

function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const role = user?.role;
  const dashboardPath = getDashboardPath(role);
  const roleDisplay = getRoleDisplay(role);

  // Check if current path starts with the given prefix
  const isActive = (path) => {
    if (path === dashboardPath) {
      return location.pathname.startsWith("/dashboard");
    }
    return location.pathname === path;
  };

  // Build nav items based on user's role
  const navItems = [];

  // Credentials — all roles (links to role-specific dashboard)
  navItems.push({
    path: dashboardPath,
    label: "Credential Vault",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  });

  // Teams — super_admin and admin
  if (role === "super_admin" || role === "admin") {
    navItems.push({
      path: "/admin/teams",
      label: "Teams",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    });
  }

  // Audit Log — super_admin and admin
  if (role === "super_admin" || role === "admin") {
    navItems.push({
      path: "/admin/audit-log",
      label: "Audit Log",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    });
  }

  // Profile — all users
  navItems.push({
    path: "/profile",
    label: "Profile",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  });

  const badgeClass = ROLE_COLORS[role] || ROLE_COLORS.employee;
  const badgeLabel = ROLE_LABELS[role] || role;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-vault-card border-r border-gray-200 dark:border-vault-border flex flex-col z-30">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-vault-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none text-gray-900 dark:text-gray-100">Vault</h1>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 tracking-wider uppercase">Password Manager</p>
          </div>
        </Link>
      </div>

      {/* Role indicator */}
      <div className="px-4 pt-4 pb-2">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${roleDisplay.bgColor} border ${roleDisplay.borderColor}`}>
          <span className="text-lg">{roleDisplay.icon}</span>
          <div>
            <p className={`text-xs font-bold ${roleDisplay.color}`}>{roleDisplay.label} Dashboard</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Role-based access active</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-3 px-3">
          Menu
        </p>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive(item.path)
                ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-vault-border/30"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Theme toggle */}
      <div className="px-4 pb-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-vault-border hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-500/30 hover:bg-primary-500/5 transition-all duration-200"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Light Mode
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Dark Mode
            </>
          )}
        </button>
      </div>

      {/* User section */}
      <div className="p-4 border-t border-gray-200 dark:border-vault-border">
        <Link
          to="/profile"
          className="flex items-center gap-3 mb-3 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-vault-border/30 py-1.5 -mx-1 transition-all cursor-pointer"
        >
          {user?.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={user.name}
              className="w-9 h-9 rounded-full object-cover border-2 border-primary-500/20"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-700/20 border border-primary-500/10 flex items-center justify-center text-sm font-bold text-primary-600 dark:text-primary-400">
              {user?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user?.name || "User"}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user?.email}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${badgeClass}`}>
            {badgeLabel}
          </span>
        </Link>
        <button
          onClick={async () => {
            await logout();
            window.location.href = "/login";
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 border border-gray-200 dark:border-vault-border hover:text-red-500 dark:hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

/**
 * SidebarLayout — wraps page content with the sidebar.
 * All authenticated pages should use this layout.
 */
function SidebarLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64">
        {children}
      </main>
    </div>
  );
}

export { Sidebar, SidebarLayout };
export default SidebarLayout;
