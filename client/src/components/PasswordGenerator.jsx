import { useState } from "react";

const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

function PasswordGenerator({ onGenerate }) {
  const [length, setLength] = useState(20);
  const [options, setOptions] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);

  const toggleOption = (key) => {
    const next = { ...options, [key]: !options[key] };
    // Ensure at least one option is selected
    if (Object.values(next).some(Boolean)) {
      setOptions(next);
    }
  };

  const generate = () => {
    let charset = "";
    if (options.uppercase) charset += CHARSETS.uppercase;
    if (options.lowercase) charset += CHARSETS.lowercase;
    if (options.numbers) charset += CHARSETS.numbers;
    if (options.symbols) charset += CHARSETS.symbols;

    if (!charset) return;

    // Use crypto.getRandomValues for secure random generation
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);

    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }

    setGenerated(password);
    setCopied(false);
  };

  const handleUse = () => {
    if (generated) {
      onGenerate(generated);
    }
  };

  const handleCopy = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silently
    }
  };

  return (
    <div className="rounded-xl bg-gray-50/50 dark:bg-vault-dark/50 border border-gray-200 dark:border-vault-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          Generator
        </h4>
      </div>

      {/* Length slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Length</span>
          <span className="text-xs font-mono text-primary-600 dark:text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">
            {length}
          </span>
        </div>
        <input
          type="range"
          min="8"
          max="64"
          value={length}
          onChange={(e) => setLength(parseInt(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary-500 bg-gray-200 dark:bg-vault-border"
        />
      </div>

      {/* Character options */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[
          { key: "uppercase", label: "A-Z" },
          { key: "lowercase", label: "a-z" },
          { key: "numbers", label: "0-9" },
          { key: "symbols", label: "!@#" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleOption(key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              options[key]
                ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20"
                : "bg-white dark:bg-vault-dark text-gray-500 dark:text-gray-600 border-gray-200 dark:border-vault-border hover:text-gray-600 dark:hover:text-gray-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={generate}
        className="w-full py-2 rounded-lg bg-gray-200/50 dark:bg-vault-border/50 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-vault-border hover:text-gray-800 dark:hover:text-gray-100 transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Generate Password
      </button>

      {/* Generated password display */}
      {generated && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-vault-dark border border-gray-200 dark:border-vault-border">
            <code className="flex-1 text-sm text-emerald-600 dark:text-emerald-400 font-mono break-all select-all">
              {generated}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-vault-border/50 transition-all"
              title="Copy"
            >
              {copied ? (
                <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={handleUse}
            className="w-full py-2 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 text-sm font-medium border border-primary-500/20 hover:bg-primary-500/20 transition-all"
          >
            Use This Password
          </button>
        </div>
      )}
    </div>
  );
}

export default PasswordGenerator;
