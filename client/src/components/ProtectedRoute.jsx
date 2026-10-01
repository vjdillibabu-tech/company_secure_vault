import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDashboardPath } from "../config/credentialConfig";

/**
 * ProtectedRoute — wraps routes that require authentication.
 *
 * Props:
 *   children    — the page component to render
 *   roles       — optional array of allowed roles, e.g. ["admin", "manager"]
 *
 * Security:
 *   - If not authenticated → redirect to /login
 *   - If authenticated but wrong role → redirect to their own role-based dashboard
 *   - The frontend role check is for UI only; backend enforces real authorization
 *
 * IMPORTANT: The user.role used here comes from the backend database
 * via GET /api/auth/me (set in AuthContext). It is NEVER read from
 * localStorage, URL parameters, or request body.
 */
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-vault-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — redirect to login, preserving the intended destination
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but wrong role — redirect to their own dashboard
  // This prevents users from manually typing /dashboard/admin in the URL
  // when they are a developer, employee, etc.
  if (roles && !roles.includes(user.role)) {
    const correctPath = getDashboardPath(user.role);
    return <Navigate to={correctPath} replace />;
  }

  return children;
}

export default ProtectedRoute;
