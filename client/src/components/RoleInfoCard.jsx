import { useState, useEffect, useRef } from "react";

/**
 * ────────────────────────────────────────────────────────
 * RoleInfoCard — Animated role detail card
 * ────────────────────────────────────────────────────────
 * Displays detailed role information when a role is
 * selected from the registration dropdown. Smoothly
 * animates open/close via max-height transition.
 */
function RoleInfoCard({ role }) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayedRole, setDisplayedRole] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (role) {
      setDisplayedRole(role);
      // Small delay to trigger CSS transition after mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setDisplayedRole(null), 350);
      return () => clearTimeout(timer);
    }
  }, [role]);

  if (!displayedRole) {
    return (
      <div className="mt-4 p-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-vault-border bg-gray-50/50 dark:bg-vault-dark/50 text-center">
        <div className="flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Select your role to view your responsibilities and vault access.
          </p>
        </div>
      </div>
    );
  }

  const r = displayedRole;

  return (
    <div
      className="mt-4 overflow-hidden transition-all duration-350 ease-out"
      style={{
        maxHeight: isVisible ? "800px" : "0px",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(-8px)",
      }}
    >
      <div className="rounded-2xl border border-gray-200 dark:border-vault-border bg-white dark:bg-vault-card shadow-lg overflow-hidden">
        {/* Header strip */}
        <div className={`px-5 py-4 bg-gradient-to-r ${r.badgeColor} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-white/5" style={{
            backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 21px)"
          }} />
          <div className="relative flex items-center gap-3">
            <span className="text-3xl drop-shadow-lg">{r.icon}</span>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">{r.label}</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white/90 backdrop-blur-sm">
                {r.accessLevel}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5" ref={contentRef}>
          {/* Main Responsibility */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Main Responsibility
              </h4>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-6">
              {r.responsibility}
            </p>
          </div>

          {/* Vault Access */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Vault Access
              </h4>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-6">
              {r.vaultAccess}
            </p>
          </div>

          {/* Two columns: Can / Cannot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Can Do */}
            <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/30 p-3.5">
              <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Can Do
              </h4>
              <ul className="space-y-1.5">
                {r.canDo.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cannot Do */}
            <div className="rounded-xl bg-red-50/60 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/30 p-3.5">
              <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cannot Do
              </h4>
              <ul className="space-y-1.5">
                {r.cannotDo.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-red-800 dark:text-red-300">
                    <span className="text-red-500 mt-0.5 shrink-0">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Access Level Badge */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-vault-border">
            <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">
              Access Level
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${r.badgeBg}`}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: r.accentColor }}
              />
              {r.accessLevel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoleInfoCard;
