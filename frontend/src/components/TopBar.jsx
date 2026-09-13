import { useState, useRef, useEffect } from "react";
import { FileText, User, Sun, Moon, ChevronDown, LogOut, LogIn, BookMarked } from "lucide-react";

export default function TopBar({
  activeTab, darkMode, setDarkMode, onHamburger,
  user, onGoogleLogin, onLogout,
  documents, activeDocId, setActiveDocId
}) {
  const [fileOpen, setFileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const fileRef = useRef(null);
  const userRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (fileRef.current && !fileRef.current.contains(e.target)) setFileOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const TAB_LABELS = {
    notes: "Revision Notes",
    flashcards: "Flashcards",
    summary: "Summary",
    deadlines: "Deadlines",
    settings: "Settings",
  };

  const activeDoc = documents?.find(d => d.id === activeDocId);
  const activeDocName = activeDoc ? (activeDoc.displayName || activeDoc.originalName || activeDoc.filename) : null;

  const initials = user?.name ? user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "S";

  return (
    <header className="topbar">
      {/* Left side */}
      <div className="topbar-left">
        <button className="hamburger-btn" onClick={onHamburger} aria-label="Menu">
          <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {[0,1,2].map(i => <span key={i} style={{ display: "block", width: 20, height: 2, background: "var(--text-muted)", borderRadius: 2 }} />)}
          </span>
        </button>

        {/* App name (visible on mobile/when sidebar hidden) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="topbar-brand">
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, var(--pink), var(--peach))", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookMarked size={14} strokeWidth={1.8} style={{ color: "var(--pink-deep)" }} />
          </div>
          <span className="topbar-title">StudyAI</span>
        </div>

        {/* Divider */}
        <span style={{ width: 1, height: 20, background: "var(--border-solid)", display: "block" }} />

        {/* Active tab label */}
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          {TAB_LABELS[activeTab] || activeTab}
        </span>
      </div>

      {/* Right side */}
      <div className="topbar-right">

        {/* File Picker */}
        {documents && documents.length > 0 && (
          <div ref={fileRef} style={{ position: "relative" }}>
            <button
              onClick={() => setFileOpen(f => !f)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "var(--surface)", border: "1px solid var(--border-solid)",
                borderRadius: "var(--radius-pill)", padding: "6px 12px",
                cursor: "pointer", fontSize: 12, color: "var(--text-muted)",
                maxWidth: 180, overflow: "hidden",
                transition: "border-color 0.15s",
              }}
              aria-label="Select document"
              id="file-picker-btn"
            >
              <FileText size={13} strokeWidth={1.8} style={{ flexShrink: 0, color: "var(--pink-deep)" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {activeDocName ? (activeDocName.length > 18 ? activeDocName.slice(0,18) + "..." : activeDocName) : "Select file"}
              </span>
              <ChevronDown size={11} />
            </button>

            {fileOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)",
                border: "var(--glass-border)", borderRadius: "var(--radius-lg)",
                boxShadow: "var(--glass-shadow)",
                minWidth: 220, zIndex: 200, overflow: "hidden",
                padding: "4px 0",
              }}>
                {documents.map(doc => {
                  const n = doc.displayName || doc.originalName || doc.filename;
                  const active = doc.id === activeDocId;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => { setActiveDocId(doc.id); setFileOpen(false); }}
                      style={{
                        width: "100%", textAlign: "left", padding: "8px 14px",
                        background: active ? "var(--pink-light)" : "transparent",
                        border: "none", cursor: "pointer",
                        fontSize: 13, color: active ? "var(--text)" : "var(--text-muted)",
                        fontWeight: active ? 600 : 400,
                        display: "flex", alignItems: "center", gap: 8,
                        overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                      }}
                    >
                      <FileText size={12} strokeWidth={1.8} style={{ flexShrink: 0, color: active ? "var(--pink-deep)" : "var(--text-light)" }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {n.length > 30 ? n.slice(0,30) + "..." : n}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Dark mode toggle */}
        <label className="dark-toggle" htmlFor="dark-mode-toggle" aria-label="Toggle dark mode">
          {darkMode ? <Moon size={14} strokeWidth={1.8} /> : <Sun size={14} strokeWidth={1.8} />}
          <div
            id="dark-mode-toggle"
            className={"toggle-switch " + (darkMode ? "on" : "")}
            onClick={() => setDarkMode(!darkMode)}
            role="switch"
            aria-checked={darkMode}
            tabIndex={0}
            onKeyDown={(e) => e.key === " " && setDarkMode(!darkMode)}
          >
            <div className="toggle-knob" />
          </div>
        </label>

        {/* Account button */}
        <div ref={userRef} style={{ position: "relative" }}>
          <button
            onClick={() => setUserOpen(u => !u)}
            className="user-avatar"
            aria-label="Account"
            id="account-btn"
            title={user?.name}
          >
            {user?.picture ? (
              <img src={user.picture} alt={user.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            ) : initials}
          </button>

          {userOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)",
              border: "var(--glass-border)", borderRadius: "var(--radius-lg)",
              boxShadow: "var(--glass-shadow)",
              minWidth: 200, zIndex: 200, padding: "var(--space-md)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "var(--space-md)", paddingBottom: "var(--space-sm)", borderBottom: "1px solid var(--border)" }}>
                <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 12, cursor: "default" }}>
                  {user?.picture ? <img src={user.picture} alt="" style={{ width: "100%", borderRadius: "50%" }} /> : initials}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{user?.name || "Student"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{user?.email || "local session"}</div>
                </div>
              </div>
              {user?.authProvider === "google" ? (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => { onLogout?.(); setUserOpen(false); }}
                >
                  <LogOut size={12} /> Sign Out
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => { onGoogleLogin?.(); setUserOpen(false); }}
                >
                  <LogIn size={12} /> Sign in with Google
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
