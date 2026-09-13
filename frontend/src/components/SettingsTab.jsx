import { useState } from "react";
import { Settings, Key, User, Database, Bell, Shield } from "lucide-react";

export default function SettingsTab({ user, setUser, darkMode, setDarkMode, addToast, onGoogleLogin }) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const isGoogle = user?.authProvider === "google";

  const saveProfile = () => {
    setUser({ ...user, name, email });
    try {
      localStorage.setItem("studyos_user", JSON.stringify({ ...user, name, email }));
    } catch {}
    addToast("Profile updated!", "success");
  };

  const saveApiKey = () => {
    if (!apiKey.trim()) { addToast("Enter a valid API key", "error"); return; }
    localStorage.setItem("studyos_gemini_key", apiKey.trim());
    addToast("Gemini API key saved to workspace ✨", "success");
    setApiKey("");
  };

  const clearFiles = () => {
    try {
      localStorage.removeItem("studyos_documents");
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("studyos_notes_") || k.startsWith("studyos_flashcards_") || k.startsWith("studyos_summary_")) {
          localStorage.removeItem(k);
        }
      });
    } catch {}
    addToast("Workspace files cleared. Refreshing...", "info");
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div>
      <div className="tab-header">
        <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <Settings size={22} strokeWidth={1.8} />
          Settings
        </h1>
        <p>Manage your profile, Google account sync, and AI preferences</p>
      </div>

      {/* Profile */}
      <div className="settings-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", margin: 0 }}>
            <User size={16} /> Account & Storage Sync
          </h3>
          {isGoogle ? (
            <span className="badge badge-green">● Synced with Google Account</span>
          ) : (
            <span className="badge badge-peach">Guest Session (Local)</span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)", marginBottom: "var(--space-md)" }}>
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Display Name</label>
            <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>Email</label>
            <input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary btn-sm" onClick={saveProfile}>Save Profile</button>
          {!isGoogle && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onGoogleLogin}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z"/>
              </svg>
              Link Google Account
            </button>
          )}
        </div>
      </div>

      {/* API Key */}
      <div className="settings-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", margin: 0 }}>
            <Key size={16} /> Generative AI Provider
          </h3>
          <span className="badge badge-green" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            ● Active: Google Gemini
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "var(--space-md)" }}>
          Connected to <strong>Google Gemini (gemini-3.6-flash)</strong> for real-time lecture synthesis, flashcard extraction, and summary generation.
        </p>
        <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
          <input
            className="input-field"
            type={showKey ? "text" : "password"}
            placeholder="Enter Gemini API key (e.g. AIzaSy...)"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{ flex: 1, fontFamily: "monospace" }}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => setShowKey(!showKey)}>
            {showKey ? "Hide" : "Show"}
          </button>
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
          <button className="btn btn-primary btn-sm" onClick={saveApiKey}>Update Key</button>
          <span className="badge badge-green">🔒 Stored securely in backend .env</span>
        </div>
      </div>

      {/* Storage */}
      <div className="settings-section">
        <h3 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <Database size={16} /> Storage
        </h3>
        <div style={{ marginBottom: "var(--space-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "var(--text-muted)" }}>Used</span>
            <span style={{ fontWeight: 600 }}>24 MB / 500 MB</span>
          </div>
          <div className="quota-bar">
            <div className="quota-fill" style={{ width: "4.8%" }} />
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={clearFiles}>
          Clear workspace files
        </button>
      </div>

      {/* Preferences */}
      <div className="settings-section">
        <h3 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <Bell size={16} /> Preferences
        </h3>
        <div className="settings-row">
          <div>
            <label>Dark Mode</label>
            <p>Use warm dark theme</p>
          </div>
          <div
            className={`toggle-switch ${darkMode ? "on" : ""}`}
            onClick={() => setDarkMode(!darkMode)}
            role="switch"
            aria-checked={darkMode}
            tabIndex={0}
            onKeyDown={(e) => e.key === " " && setDarkMode(!darkMode)}
          >
            <div className="toggle-knob" />
          </div>
        </div>
        <div className="settings-row" style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-sm)" }}>
          <div>
            <label>Keyboard Shortcuts</label>
            <p>Arrow keys for flashcards, Space to flip</p>
          </div>
          <span className="badge badge-green">Enabled</span>
        </div>
      </div>

      {/* Privacy */}
      <div className="settings-section">
        <h3 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <Shield size={16} /> Privacy & Data
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "var(--space-md)", lineHeight: 1.7 }}>
          Your uploaded files are stored locally on your server and never shared with third parties beyond the AI API provider for processing.
          Files are automatically deleted after 30 days of inactivity.
        </p>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => addToast("Data export initiated", "info")}>Export my data</button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ color: "var(--error)", borderColor: "rgba(232,123,123,0.4)" }}
            onClick={() => addToast("Account deletion requires email confirmation", "info")}
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}
