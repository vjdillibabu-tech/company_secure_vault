import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gray-50 dark:bg-vault-dark">
      <h1 className="text-8xl font-extrabold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent mb-4">
        404
      </h1>
      <p className="text-xl text-gray-500 dark:text-gray-400 mb-8">This page doesn't exist</p>
      <Link
        to="/"
        className="px-6 py-3 rounded-xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border text-gray-600 dark:text-gray-300 font-medium hover:border-primary-500/50 transition-all duration-200"
      >
        ← Go home
      </Link>
    </div>
  );
}

export default NotFound;
