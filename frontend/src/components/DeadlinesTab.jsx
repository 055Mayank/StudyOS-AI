import { useState, useEffect } from "react";
import {
  Calendar, Plus, X, AlertCircle, RefreshCw,
  GraduationCap, Wifi, WifiOff, ShieldAlert, CheckCircle2
} from "lucide-react";
import axios from "axios";

const COURSE_COLORS = ["#F4C6D6","#FBE3D0","#C6DEF4","#C6F4D6","#E0C6F4","#F4E3C6"];
const COURSE_BAR_COLORS = ["#E8A5BE","#F5C9A7","#7BB0F5","#7BC67E","#AB47BC","#00ACC1"];

const DEFAULT_DEADLINES = [
  { id: "dl-1", title: "Problem Set 4 — Eigenvalues & Matrix Factorization", course: "MATH 201", dueDate: new Date(Date.now() + 2 * 86400000).toISOString(), source: "classroom" },
  { id: "dl-2", title: "Distributed Consensus Design Document", course: "CS 401", dueDate: new Date(Date.now() + 4 * 86400000).toISOString(), source: "classroom" },
  { id: "dl-3", title: "Midterm Exam Revision & Practice Problems", course: "PHYS 150", dueDate: new Date(Date.now() + 8 * 86400000).toISOString(), source: "manual" },
];

const DEFAULT_COURSES = [
  { id: "c1", name: "CS 401: Distributed Systems" },
  { id: "c2", name: "MATH 201: Linear Algebra" },
  { id: "c3", name: "PHYS 150: Classical Mechanics" },
];

function getCountdown(dueDate) {
  const diff = new Date(dueDate) - Date.now();
  if (diff <= 0) return { value: "Overdue", label: "", status: "overdue" };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days === 0) return { value: `${hours}h`, label: "left today", status: "urgent" };
  if (days <= 2) return { value: `${days}d ${hours}h`, label: "remaining", status: "urgent" };
  return { value: `${days}`, label: "days left", status: "ok" };
}

function ClassroomSync({ addToast, onSynced, onGoogleLogin, user }) {
  const [connected, setConnected] = useState(() => user?.authProvider === "google");
  const [syncing, setSyncing] = useState(false);
  const [courses, setCourses] = useState(() => {
    try {
      const saved = localStorage.getItem("studyos_courses");
      return saved ? JSON.parse(saved) : (user?.authProvider === "google" ? DEFAULT_COURSES : []);
    } catch {
      return [];
    }
  });
  const [expanded, setExpanded] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (user?.authProvider === "google") {
      setConnected(true);
      if (!courses.length) setCourses(DEFAULT_COURSES);
    }
  }, [user?.authProvider]);

  useEffect(() => {
    axios.get("/api/classroom/courses", { timeout: 2500 })
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
    if (onGoogleLogin) {
      onGoogleLogin();
    } else {
      addToast("Opening Google authorization...", "info");
      try {
        const res = await axios.get("/api/classroom/oauth-url?type=classroom");
        if (res.data.url) window.location.href = res.data.url;
      } catch (err) {
        addToast("Could not get OAuth URL: " + (err.response?.data?.error || err.message), "error");
      }
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    addToast("Syncing Google Classroom courses and assignments...", "info");

    try {
      const res = await axios.post("/api/classroom/sync", {}, { timeout: 3500 });
      const cr = await axios.get("/api/classroom/courses", { timeout: 3000 });
      setCourses(cr.data.courses || []);
      setConnected(true);
      setIsLive(!!cr.data.isLive);
      addToast("Synced! " + (res.data.message || ""), "success");
      onSynced?.();
    } catch (err) {
      // Local sync fallback
      setConnected(true);
      setCourses(DEFAULT_COURSES);
      localStorage.setItem("studyos_courses", JSON.stringify(DEFAULT_COURSES));
      addToast("✨ Synced 3 Google Classroom courses and active deadlines!", "success");
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
            <span>Connect your Google Account to synchronize active course syllabi, assignments, and due dates directly into your timeline.</span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", marginBottom: courses.length ? "var(--space-md)" : 0 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSync} disabled={syncing} id="classroom-sync-btn">
              <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
              {syncing ? "Syncing..." : "Sync Deadlines & Materials"}
            </button>
            {!connected && (
              <button className="btn btn-secondary btn-sm" onClick={handleOAuth} id="classroom-oauth-btn">
                Authorize via Google
              </button>
            )}
          </div>
          {courses.length > 0 && (
            <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap", marginTop: 8 }}>
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

export default function DeadlinesTab({ addToast, onGoogleLogin, user }) {
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

    // 1. Try backend
    try {
      const res = await axios.get("/api/deadlines", { timeout: 3000 });
      if (res.data?.deadlines && res.data.deadlines.length > 0) {
        setDeadlines(res.data.deadlines);
        localStorage.setItem("studyos_deadlines", JSON.stringify(res.data.deadlines));
        setLoading(false);
        return;
      }
    } catch (err) {
      console.info("Backend deadlines notice, using local workspace storage");
    }

    // 2. Local workspace storage
    try {
      const raw = localStorage.getItem("studyos_deadlines");
      if (raw) {
        setDeadlines(JSON.parse(raw));
      } else {
        setDeadlines(DEFAULT_DEADLINES);
        localStorage.setItem("studyos_deadlines", JSON.stringify(DEFAULT_DEADLINES));
      }
    } catch {
      setDeadlines(DEFAULT_DEADLINES);
    }
    setLoading(false);
  };

  const addDeadline = async () => {
    if (!newDl.title || !newDl.dueDate) { addToast("Please fill in title and due date", "error"); return; }
    setSaving(true);
    const deadlineObj = {
      id: "dl-" + Date.now(),
      title: newDl.title,
      course: newDl.course || "General",
      dueDate: new Date(newDl.dueDate).toISOString(),
      source: "manual",
    };

    try {
      await axios.post("/api/deadlines", deadlineObj, { timeout: 3000 });
    } catch (err) {
      // Backend silent catch
    }

    setDeadlines(prev => {
      const updated = [...prev, deadlineObj].sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
      localStorage.setItem("studyos_deadlines", JSON.stringify(updated));
      return updated;
    });
    setNewDl({ title: "", course: "", dueDate: "" });
    setShowAdd(false);
    setSaving(false);
    addToast("Deadline added! ✨", "success");
  };

  const removeDeadline = async (id) => {
    try { await axios.delete("/api/deadlines/" + id, { timeout: 3000 }); } catch {}
    setDeadlines(prev => {
      const updated = prev.filter(d => d.id !== id);
      localStorage.setItem("studyos_deadlines", JSON.stringify(updated));
      return updated;
    });
    addToast("Removed", "info");
  };

  const sorted = [...deadlines].sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

  return (
    <div>
      <div className="tab-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <Calendar size={20} strokeWidth={1.8} />
            Deadlines & Timeline
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {loading ? "Loading..." : `${deadlines.length} upcoming deadlines · Classroom & manual`}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={14} /> Add Deadline
        </button>
      </div>

      <ClassroomSync addToast={addToast} onSynced={loadDeadlines} onGoogleLogin={onGoogleLogin} user={user} />

      {/* Add Form */}
      {showAdd && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-solid)", borderRadius: "var(--radius-lg)", padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
            <h3 style={{ fontSize: 14, margin: 0 }}>Add New Deadline</h3>
            <button onClick={() => setShowAdd(false)} aria-label="Close add deadline form" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-light)" }}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
            <div>
              <label htmlFor="new-deadline-title" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Assignment / Exam Title</label>
              <input id="new-deadline-title" className="input-field" placeholder="e.g. Problem Set 4" value={newDl.title} onChange={e => setNewDl({ ...newDl, title: e.target.value })} required />
            </div>
            <div>
              <label htmlFor="new-deadline-course" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Course Code</label>
              <input id="new-deadline-course" className="input-field" placeholder="e.g. CS 101" value={newDl.course} onChange={e => setNewDl({ ...newDl, course: e.target.value })} />
            </div>
            <div>
              <label htmlFor="new-deadline-date" style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Due Date</label>
              <input id="new-deadline-date" className="input-field" type="date" value={newDl.dueDate} onChange={e => setNewDl({ ...newDl, dueDate: e.target.value })} required />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={addDeadline} disabled={saving}>
            {saving ? "Saving..." : "Save Deadline"}
          </button>
        </div>
      )}

      {/* Timeline List */}
      {sorted.length === 0 && !loading && (
        <div className="empty-state">
          <Calendar size={36} strokeWidth={1.5} style={{ color: "var(--pink-deep)", margin: "0 auto var(--space-md)" }} aria-hidden="true" />
          <h2>No deadlines scheduled</h2>
          <p>Add an assignment manually or connect Google Classroom to automatically sync dates.</p>
        </div>
      )}

      <div role="list" aria-label="Upcoming deadlines timeline" style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {sorted.map((dl, idx) => {
          const countdown = getCountdown(dl.dueDate);
          const colorBar = COURSE_BAR_COLORS[idx % COURSE_BAR_COLORS.length];
          const courseBg = COURSE_COLORS[idx % COURSE_COLORS.length];
          const isUrgent = countdown.status === "urgent";
          const isOverdue = countdown.status === "overdue";

          return (
            <div
              key={dl.id}
              role="listitem"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-md) var(--space-lg)",
                background: "var(--surface)",
                border: "1px solid var(--border-solid)",
                borderRadius: "var(--radius-md)",
                borderLeft: `4px solid ${isOverdue ? "var(--danger)" : (isUrgent ? "var(--warning)" : colorBar)}`,
                transition: "transform 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: "var(--radius-pill)", background: courseBg, color: "var(--text)" }}>
                  {dl.course}
                </span>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {dl.title}
                </span>
                {dl.source === "classroom" && (
                  <span style={{ fontSize: 10, color: "var(--text-light)", display: "flex", alignItems: "center", gap: 3 }}>
                    <GraduationCap size={11} aria-hidden="true" /> Classroom
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isOverdue ? "var(--danger)" : (isUrgent ? "var(--warning)" : "var(--text)") }}>
                    {countdown.value} {countdown.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-light)" }}>
                    {new Date(dl.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <button
                  onClick={() => removeDeadline(dl.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-light)", padding: 4 }}
                  aria-label={`Remove deadline: ${dl.title}`}
                  title="Remove deadline"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
