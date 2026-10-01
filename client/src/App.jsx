import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AuditLogPage from "./pages/AuditLogPage";
import TeamsPage from "./pages/TeamsPage";
import ProfilePage from "./pages/ProfilePage";
import VerificationSuccess from "./pages/VerificationSuccess";
import NotFound from "./pages/NotFound";
import { getDashboardPath } from "./config/credentialConfig";

/**
 * RoleDashboardRedirect — Redirects /dashboard to the correct
 * role-based dashboard path using the authenticated user's role
 * as retrieved from the backend database.
 *
 * The role used here is the one fetched from GET /api/auth/me,
 * NOT from localStorage, URL, or any client-side source.
 */
function RoleDashboardRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getDashboardPath(user.role)} replace />;
}

function AppContent() {
  const { theme } = useTheme();

  return (
    <div className={theme === "dark" ? "dark" : "light"}>
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-vault-dark dark:text-gray-100">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verification-success" element={<VerificationSuccess />} />

          {/* ── Role-Based Dashboard Routes ── */}
          {/* /dashboard redirects to the correct role-based path */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleDashboardRedirect />
              </ProtectedRoute>
            }
          />

          {/*
           * ═══ STRICT ROLE-BASED DASHBOARD ACCESS ═══
           *
           * Each dashboard path is accessible ONLY to its specific role.
           * A developer cannot access /dashboard/admin by typing the URL.
           * A manager cannot access /dashboard/super-admin.
           *
           * If a user tries to access another role's dashboard,
           * ProtectedRoute redirects them to their own dashboard.
           *
           * The frontend role check is for UI routing only —
           * the backend enforces real authorization on all API calls.
           */}

          {/* Super Admin Dashboard — super_admin only */}
          <Route
            path="/dashboard/super-admin"
            element={
              <ProtectedRoute roles={["super_admin"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Dashboard — admin only */}
          <Route
            path="/dashboard/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Manager Dashboard — manager only */}
          <Route
            path="/dashboard/manager"
            element={
              <ProtectedRoute roles={["manager"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Developer Dashboard — developer only */}
          <Route
            path="/dashboard/developer"
            element={
              <ProtectedRoute roles={["developer"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Employee Dashboard — employee only */}
          <Route
            path="/dashboard/employee"
            element={
              <ProtectedRoute roles={["employee"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* ── Profile — all authenticated users ── */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* ── Admin routes — super_admin and admin ── */}
          <Route
            path="/admin/teams"
            element={
              <ProtectedRoute roles={["super_admin", "admin"]}>
                <TeamsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/audit-log"
            element={
              <ProtectedRoute roles={["super_admin", "admin"]}>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
