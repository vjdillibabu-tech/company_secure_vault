import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function VerificationSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get("token");
    const returnUrl = urlParams.get("returnUrl") || "/dashboard";

    if (token) {
      // Store the token in session storage for the modal to pick up
      sessionStorage.setItem("verificationToken", token);
      // Redirect back to the return URL (dashboard or profile)
      setTimeout(() => {
        navigate(returnUrl, { replace: true });
      }, 100);
    } else {
      // No token, redirect to login
      navigate("/login", { replace: true });
    }
  }, [location, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-vault-dark">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Processing verification...</p>
      </div>
    </div>
  );
}

export default VerificationSuccess;
