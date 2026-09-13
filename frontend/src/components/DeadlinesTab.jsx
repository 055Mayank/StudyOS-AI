import { useState, useEffect } from "react";
import {
  Calendar, Plus, X, AlertCircle, RefreshCw,
  GraduationCap, Wifi, WifiOff, ShieldAlert
} from "lucide-react";
import axios from "axios";

const COURSE_COLORS = ["#F4C6D6","#FBE3D0","#C6DEF4","#C6F4D6","#E0C6F4","#F4E3C6"];
const COURSE_BAR_COLORS = ["#E8A5BE","#F5C9A7","#7BB0F5","#7BC67E","#AB47BC","#00ACC1"];

function getCountdown(dueDate) {
  const diff = new Date(dueDate) - Date.now();
  if (diff <= 0) return { value: "Overdue", label: "", status: "overdue" };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days === 0) return { value: `${hours}h`, label: "left today", status: "urgent" };
  if (days <= 2) return { value: `${days}d ${hours}h`, label: "remaining", status: "urgent" };
  return { value: `${days}`, label: "days left", status: "ok" };
}

function ClassroomSync({ addToast, onSynced }) {
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [courses, setCourses] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    axios.get("/api/classroom/courses")
      .then(res => {
        if (res.data.courses?.length > 0) {
          setCourses(res.data.courses);
          setConnected(true);
          setIsLive(!!res.data.isLive);
        }
      })
      .catch(() => {});
  }, []);

  const handleOAuth = async () => {
    addToast("Opening Google authorization...", "info");
    try {
      const res = await axios.get("/api/classroom/oauth-url?type=classroom");
      if (res.data.url) window.location.href = res.data.url;
    } catch (err) {
      addToast("Could not get OAuth URL: " + (err.response?.data?.error || err.message), "error");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    addToast("Syncing Google Classroom...", "info");
    try {
      const res = await axios.post("/api/classroom/sync");
      const cr = await axios.get("/api/classroom/courses");
      setCourses(cr.data.courses || []);
      setConnected(true);
      setIsLive(!!cr.data.isLive);
      addToast("Synced! " + (res.data.message || ""), "success");
      onSynced?.();
    } catch (err) {
      addToast("Sync: " + (err.response?.data?.error || err.message), "error");
      onSynced?.();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-solid)", borderRadius: "var(--radius-lg)", marginBottom: "var(--space-lg)", overflow: "hidden" }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-md) var(--space-lg)", background: "none", border: "none", cursor: "pointer", borderBottom: expanded ? "1px solid var(--border)" : "none" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
          <GraduationCap size={16} strokeWidth={1.8} style={{ color: "var(--pink-deep)" }} />
          Google Classroom Sync
          {connected ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--success)", background: "rgba(123,198,126,0.12)", padding: "2px 8px", borderRadius: "var(--radius-pill)", fontWeight: 500 }}>
              <Wifi size={11} /> {isLive ? "Live" : "Connected"}
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-light)", background: "var(--pink-light)", padding: "2px 8px", borderRadius: "var(--radius-pill)" }}>
              <WifiOff size={11} /> Not connected
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-light)" }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "var(--space-md) var(--space-lg)" }}>
          <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "flex-start", background: "rgba(244,198,214,0.15)", borderRadius: "var(--radius-md)", padding: "var(--space-sm) var(--space-md)", marginBottom: "var(--space-md)", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            <ShieldAlert size={13} style={{ flexShrink: 0, marginTop: 2, color: "var(--pink-deep)" }} />
            <span>If blocked, add your Gmail as a <strong>Test User</strong> in Google Cloud Console, APIs and Services, OAuth consent screen, Test users.</span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", marginBottom: courses.length ? "var(--space-md)" : 0 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSync} disabled={syncing} id="classroom-sync-btn">
              <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
              {syncing ? "Syncing..." : "Sync Deadlines and Materials"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleOAuth} id="classroom-oauth-btn">
              Authorize via Google
            </button>
          </div>
          {courses.length > 0 && (
            <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
              {courses.slice(0, 6).map((c, i) => (
                <span key={c.id || i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: "var(--radius-pill)", background: COURSE_COLORS[i % COURSE_COLORS.length], color: "var(--text)", fontWeight: 500 }}>
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DeadlinesTab({ addToast }) {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDl, setNewDl] = useState({ title: "", course: "", dueDate: "" });

  useEffect(() => { loadDeadlines(); }, []);

  const loadDeadlines = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("/api/deadlines");
      setDeadlines(res.data.deadlines || []);
    } catch (err) {
      setError("Could not load deadlines: " + (err.response?.data?.error || err.message));
      setDeadlines([]);
    } finally {
      setLoading(false);
    }
  };

  const addDeadline = async () => {
    if (!newDl.title || !newDl.dueDate) { addToast("Please fill in title and due date", "error"); return; }
    setSaving(true);
    try {
      const res = await axios.post("/api/deadlines", { title: newDl.title, course: newDl.course || "General", dueDate: new Date(newDl.dueDate).toISOString(), source: "manual" });
      setDeadlines(prev => [...prev, res.data.deadline].sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)));
      setNewDl({ title: "", course: "", dueDate: "" });
      setShowAdd(false);
      addToast("Deadline added!", "success");
    } catch (err) {
      addToast("Failed: " + (err.response?.data?.error || err.message), "error");
    } finally {
      setSaving(false);
    }
  };

  const removeDeadline = async (id) => {
    try { await axios.delete("/api/deadlines/" + id); } catch {}
    setDeadlines(prev => prev.filter(d => d.id !== id));
    addToast("Removed", "info");
  };

  const sorted = [...deadlines].sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

  return (
    <div>
      <div className="tab-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <Calendar size={20} strokeWidth={1.8} />
            Deadlines and Timeline
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {loading ? "Loading..." : deadlines.length + " upcoming — manual + Classroom"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button className="btn btn-secondary btn-sm" onClick={loadDeadlines} disabled={loading} title="Refresh deadlines">
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)} id="add-deadline-btn">
            <Plus size={14} /> Add Deadline
          </button>
        </div>
      </div>

      <ClassroomSync addToast={addToast} onSynced={loadDeadlines} />

      {showAdd && (
        <div className="glass-card" style={{ marginBottom: "var(--space-lg)" }}>
          <h3 style={{ marginBottom: "var(--space-md)", fontSize: 14, fontWeight: 600 }}>New Deadline</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            <input className="input-field" placeholder="Assignment title *" value={newDl.title} onChange={e => setNewDl(p => ({ ...p, title: e.target.value }))} />
            <input className="input-field" placeholder="Course name" value={newDl.course} onChange={e => setNewDl(p => ({ ...p, course: e.target.value }))} />
            <input className="input-field" type="datetime-local" value={newDl.dueDate} onChange={e => setNewDl(p => ({ ...p, dueDate: e.target.value }))} style={{ gridColumn: "1 / -1" }} />
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)" }}>
            <button className="btn btn-primary btn-sm" onClick={addDeadline} disabled={saving}>
              {saving ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={13} />}
              {saving ? "Saving..." : "Add"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="timeline">{[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 80, marginBottom: 16 }} />)}</div>
      ) : error ? (
        <div style={{ padding: "var(--space-xl)", background: "var(--surface)", border: "1px solid rgba(232,123,123,0.3)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-md)", textAlign: "center" }}>
          <AlertCircle size={28} color="var(--error)" strokeWidth={1.75} />
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={loadDeadlines}><RefreshCw size={13} /> Retry</button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Calendar size={36} strokeWidth={1.5} /></div>
          <h2>No deadlines yet</h2>
          <p>Add one manually above, or click Sync to import from Google Classroom.</p>
        </div>
      ) : (
        <div className="timeline">
          {sorted.map((dl, i) => {
            const cd = getCountdown(dl.dueDate);
            const barColor = COURSE_BAR_COLORS[i % COURSE_BAR_COLORS.length];
            const dotClass = cd.status === "overdue" ? "overdue" : cd.status === "urgent" ? "urgent" : "";
            return (
              <div key={dl.id} className="timeline-item">
                <div className={"timeline-dot " + dotClass} />
                <div className="deadline-card">
                  <div style={{ width: 4, minHeight: 48, background: barColor, borderRadius: 2, flexShrink: 0 }} />
                  <div className="deadline-info">
                    <div className="deadline-title">{dl.title}</div>
                    <div className="deadline-meta">
                      <span className="badge badge-pink">{dl.course || "General"}</span>
                      <span>·</span>
                      <span>{new Date(dl.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {dl.source === "classroom" && (
                        <span className="badge badge-blue" style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <GraduationCap size={10} /> Classroom
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="deadline-countdown">
                    <div className="countdown-value" style={{ color: cd.status === "overdue" ? "var(--error)" : cd.status === "urgent" ? "var(--warning)" : "var(--pink-deep)" }}>
                      {cd.value}
                    </div>
                    <div className="countdown-label">{cd.label}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: "4px", minWidth: 0 }} onClick={() => removeDeadline(dl.id)} aria-label="Remove">
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
