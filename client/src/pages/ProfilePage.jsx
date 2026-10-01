import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import SidebarLayout from "../components/SidebarLayout";
import { EyeIcon } from "../components/EyeIcon";
import { EyeSlashIcon } from "../components/EyeSlashIcon";

function ProfilePage() {
  const { user, api, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  // Profile form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePicture, setProfilePicture] = useState(null);
  const [originalData, setOriginalData] = useState({});

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // UI state
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });

  // Google account linking state
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googleEmail, setGoogleEmail] = useState(null);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [securityMessage, setSecurityMessage] = useState({ type: "", text: "" });

  // Password visibility state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/auth/me");
        const u = res.data.user;
        setName(u.name);
        setEmail(u.email);
        setProfilePicture(u.profilePicture || null);
        setOriginalData({
          name: u.name,
          email: u.email,
          profilePicture: u.profilePicture || null,
        });
        setGoogleLinked(u.googleLinked || false);
        setGoogleEmail(u.googleEmail || null);
      } catch {
        setProfileMessage({ type: "error", text: "Failed to load profile." });
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [api]);

  // Check for successful Google linking on component mount
  useEffect(() => {
    const checkGoogleLinking = async () => {
      const token = sessionStorage.getItem("verificationToken");
      if (token) {
        // Clear the token
        sessionStorage.removeItem("verificationToken");
        setLinkingGoogle(false);
        // Refresh profile to get updated Google status
        try {
          const res = await api.get("/auth/me");
          const u = res.data.user;
          setGoogleLinked(u.googleLinked || false);
          setGoogleEmail(u.googleEmail || null);
          setSecurityMessage({ type: "success", text: "Google account linked successfully!" });
          // Clear the success message after 5 seconds
          setTimeout(() => {
            setSecurityMessage({ type: "", text: "" });
          }, 5000);
        } catch (err) {
          setSecurityMessage({ type: "error", text: "Failed to verify Google account linking." });
        }
      }
    };
    checkGoogleLinking();
  }, [api]);

  const profileChanged =
    name !== originalData.name ||
    email !== originalData.email ||
    profilePicture !== originalData.profilePicture;

  const passwordFormValid =
    currentPassword && newPassword && confirmNewPassword && newPassword === confirmNewPassword && newPassword.length >= 6;

  const handlePictureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Limit to 4MB
    if (file.size > 4 * 1024 * 1024) {
      setProfileMessage({ type: "error", text: "Image must be smaller than 4MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfilePicture(reader.result); // base64 data URL
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage({ type: "", text: "" });

    try {
      const res = await api.put("/auth/profile", { name, email, profilePicture });
      const u = res.data.user;
      setOriginalData({
        name: u.name,
        email: u.email,
        profilePicture: u.profilePicture || null,
      });
      updateUser(u);
      setProfileMessage({ type: "success", text: "Profile updated successfully." });
    } catch (err) {
      setProfileMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to update profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setSavingPassword(true);
    setPasswordMessage({ type: "", text: "" });

    try {
      await api.put("/auth/change-password", { currentPassword, newPassword });
      setPasswordMessage({ type: "success", text: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to change password.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLinkGoogle = () => {
    setLinkingGoogle(true);
    setSecurityMessage({ type: "", text: "" });
    // Redirect to Google OAuth endpoint with return URL
    window.location.href = "http://localhost:5000/api/auth/google?returnUrl=/profile";
  };

  if (loadingProfile) {
    return (
      <SidebarLayout>
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="px-6 lg:px-10 py-10 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1 text-gray-900 dark:text-gray-100">Profile</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Manage your account information and security settings.
          </p>
        </div>

        {/* ── Profile Info Section ── */}
        <form onSubmit={handleSaveProfile} className="rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Personal Information
          </h2>

          {/* Profile Picture */}
          <div className="flex items-center gap-6 mb-6">
            <div className="relative group">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-3 border-primary-500/20 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-700/20 border-2 border-primary-500/10 flex items-center justify-center text-2xl font-bold text-primary-600 dark:text-primary-400 shadow-lg">
                  {name?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors"
                title="Change picture"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePictureUpload}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile Picture</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                JPG, PNG, or GIF. Max 4MB. Stored as base64.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-xs text-primary-500 hover:text-primary-400 font-medium transition-colors"
              >
                {profilePicture ? "Change" : "Upload"} photo
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="mb-4">
            <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Full Name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Your full name"
            />
          </div>

          {/* Email */}
          <div className="mb-4">
            <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Email Address
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="you@company.com"
            />
          </div>

          {/* Role (read-only) */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Role
            </label>
            <div className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-vault-dark/50 border border-gray-200 dark:border-vault-border text-gray-500 dark:text-gray-400 text-sm capitalize cursor-not-allowed">
              {user?.role || "employee"}
              <span className="text-xs text-gray-400 dark:text-gray-600 ml-2">(cannot be changed)</span>
            </div>
          </div>

          {/* Message */}
          {profileMessage.text && (
            <div
              className={`mb-4 p-3 rounded-xl text-sm ${
                profileMessage.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
              }`}
            >
              {profileMessage.text}
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={!profileChanged || savingProfile}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {savingProfile ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </form>

        {/* ── Password Section ── */}
        <form onSubmit={handleChangePassword} className="rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Change Password
          </h2>

          {/* Current Password */}
          <div className="mb-4">
            <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-12"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                tabIndex={-1}
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="mb-4">
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-12"
                placeholder="Min. 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                tabIndex={-1}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="mb-5">
            <label htmlFor="confirm-new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirm-new-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-12"
                placeholder="Re-enter new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </button>
            </div>
            {newPassword && confirmNewPassword && newPassword !== confirmNewPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
            )}
          </div>

          {/* Message */}
          {passwordMessage.text && (
            <div
              className={`mb-4 p-3 rounded-xl text-sm ${
                passwordMessage.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
              }`}
            >
              {passwordMessage.text}
            </div>
          )}

          {/* Change Password Button */}
          <button
            type="submit"
            disabled={!passwordFormValid || savingPassword}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {savingPassword ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Changing…
              </span>
            ) : (
              "Change Password"
            )}
          </button>
        </form>

        {/* ── Security Section ── */}
        <div className="rounded-2xl bg-white dark:bg-vault-card border border-gray-200 dark:border-vault-border p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Security
          </h2>

          {/* Google Account Linking Status */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Google Account</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Link your Google account for identity verification
                </p>
              </div>
              {googleLinked ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Linked</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Not Linked</span>
                </div>
              )}
            </div>

            {googleLinked && googleEmail ? (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-vault-dark border border-gray-200 dark:border-vault-border">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Linked email:</span> {googleEmail}
                </p>
              </div>
            ) : (
              <button
                onClick={handleLinkGoogle}
                disabled={linkingGoogle}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-vault-dark border border-gray-300 dark:border-vault-border text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-vault-border/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {linkingGoogle ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                    <span>Linking...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Link Google Account</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Security Message */}
          {securityMessage.text && (
            <div
              className={`p-3 rounded-xl text-sm ${
                securityMessage.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
              }`}
            >
              {securityMessage.text}
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            Your Google account is used for identity verification when revealing or updating passwords.
            Your Google password is never shared with us.
          </p>
        </div>
      </div>
    </SidebarLayout>
  );
}

export default ProfilePage;
