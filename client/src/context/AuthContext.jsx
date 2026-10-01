import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);

// Axios instance with base URL and auth header
const api = axios.create({ baseURL: "/api" });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("vault_token"));
  const [loading, setLoading] = useState(true);

  // Attach token to every request
  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("vault_token", token);
    } else {
      delete api.defaults.headers.common["Authorization"];
      localStorage.removeItem("vault_token");
    }
  }, [token]);

  // ═══ CRITICAL: Verify token and fetch user info from BACKEND on mount ═══
  // NEVER trust localStorage or JWT payload for the user's role.
  // The backend GET /api/auth/me is the source of truth.
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // Quick expiry check from JWT to avoid unnecessary network call
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        setToken(null);
        setUser(null);
        localStorage.removeItem("vault_user");
        setLoading(false);
        return;
      }
    } catch {
      setToken(null);
      setUser(null);
      localStorage.removeItem("vault_user");
      setLoading(false);
      return;
    }

    // Set auth header immediately so the /me request works
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // Fetch the user profile (including role) from the backend database
    api.get("/auth/me")
      .then((res) => {
        const backendUser = res.data.user;
        setUser(backendUser);
        localStorage.setItem("vault_user", JSON.stringify(backendUser));
      })
      .catch(() => {
        // Token is invalid or expired — clear everything
        setToken(null);
        setUser(null);
        localStorage.removeItem("vault_token");
        localStorage.removeItem("vault_user");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    setToken(res.data.token);
    // The role in res.data.user comes from the backend database
    setUser(res.data.user);
    localStorage.setItem("vault_user", JSON.stringify(res.data.user));
    return res.data;
  };

  const register = async (name, email, password, role, username) => {
    const res = await api.post("/auth/register", { name, email, password, role, username });
    setToken(res.data.token);
    // The role in res.data.user comes from the backend database
    setUser(res.data.user);
    localStorage.setItem("vault_user", JSON.stringify(res.data.user));
    return res.data;
  };

  // ═══ Audit-logged logout ═══
  // Calls POST /api/auth/logout to create an audit log entry,
  // then clears local state regardless of API success.
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Logout should succeed even if the API call fails
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem("vault_token");
    localStorage.removeItem("vault_user");
  };

  // Update user state after profile changes (merge new data into existing)
  // NOTE: The role field is NEVER updated from the frontend.
  // Only name, email, profilePicture etc. are merged.
  const updateUser = (updatedFields) => {
    setUser((prev) => {
      // SECURITY: Strip any role override attempt from updatedFields
      const { role: _ignoreRole, ...safeFields } = updatedFields;
      const merged = { ...prev, ...safeFields, role: prev?.role };
      localStorage.setItem("vault_user", JSON.stringify(merged));
      return merged;
    });
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateUser,
    api, // Expose the configured axios instance
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { api };
