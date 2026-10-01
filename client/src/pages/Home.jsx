import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

function Home() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() => setHealth({ status: "unreachable" }));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gray-50 dark:bg-vault-dark">
      {/* Hero */}
      <div className="text-center max-w-2xl">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25 mb-8">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight mb-4">
          <span className="bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            Company Vault
          </span>
        </h1>

        <p className="text-lg text-gray-500 dark:text-gray-400 mb-10 leading-relaxed">
          Secure, role-based password management for your entire organization.
          Keep credentials safe, organized, and accessible to the right people.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/login"
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:scale-105 transition-all duration-200"
          >
            Get Started
          </Link>
          <Link
            to="/dashboard"
            className="px-8 py-3 rounded-xl border border-gray-300 dark:border-vault-border text-gray-600 dark:text-gray-300 font-semibold hover:bg-white dark:hover:bg-vault-card hover:border-primary-500/50 transition-all duration-200"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Health Status */}
      <div className="mt-16 p-4 rounded-xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border">
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              health?.status === "ok"
                ? "bg-emerald-400 shadow-lg shadow-emerald-400/50"
                : "bg-amber-400 shadow-lg shadow-amber-400/50 animate-pulse"
            }`}
          />
          <span className="text-gray-500 dark:text-gray-400">
            API Status:{" "}
            <span className={health?.status === "ok" ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"}>
              {health ? health.status : "checking..."}
            </span>
          </span>
          {health?.database && (
            <span className="text-gray-400 dark:text-gray-500 ml-2">
              · DB: <span className="text-gray-600 dark:text-gray-400">{health.database}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
