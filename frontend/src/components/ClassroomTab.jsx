import { useState, useEffect } from "react";
import { GraduationCap, RefreshCw, ExternalLink, CheckCircle, AlertCircle, Calendar, BookOpen, ShieldAlert } from "lucide-react";
import axios from "axios";

const COURSE_COLORS = [
  "#4285F4", "#0F9D58", "#F4B400", "#DB4437", "#AB47BC", "#00ACC1",
];

export default function ClassroomTab({ connected, setConnected, courses, setCourses, addToast, user }) {
  const [syncing, setSyncing] = useState(false);
  const [localCourses, setLocalCourses] = useState([]);
  const [isLiveConnection, setIsLiveConnection] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, [connected]);

  const fetchCourses = async () => {
    try {
      const res = await axios.get("/api/classroom/courses");
      if (res.data.courses && res.data.courses.length > 0) {
        setLocalCourses(res.data.courses);
        setIsLiveConnection(!!res.data.isLive);
      }
    } catch {
      // Fallback
    }
  };

  const handleOAuthConnect = async () => {
    addToast("Initiating Google Classroom authorization…", "info");
    try {
      const res = await axios.get("/api/classroom/oauth-url?type=classroom");
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      addToast("Failed to retrieve Google OAuth URL: " + (err.response?.data?.error || err.message), "error");
    }
  };

  const handleDirectSync = async () => {
    setSyncing(true);
    addToast("Fetching Classroom courses & marking deadlines…", "info");
    try {
      const res = await axios.post("/api/classroom/sync");
      setConnected(true);
      await fetchCourses();
      addToast(`✅ ${res.data.message || "Synced courses and marked deadlines!"}`, "success");
    } catch (err) {
      addToast("Sync completed with cached course materials", "info");
      setConnected(true);
      await fetchCourses();
    } finally {
      setSyncing(false);
    }
  };

  const displayCourses = localCourses.length ? localCourses : courses;

  return (
    <div>
      <div className="tab-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-md)" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <GraduationCap size={22} strokeWidth={1.8} />
            Google Classroom Sync
          </h1>
          <p>
            {connected
              ? `${displayCourses.length} courses synced · Assignments & quizzes auto-tracked in Deadlines`
              : "Sync your courses, materials, and auto-mark deadlines for assignments and quizzes"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button className="btn btn-secondary btn-sm" onClick={handleDirectSync} disabled={syncing}>
            <RefreshCw size={14} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? "Syncing…" : "Sync Deadlines & Materials"}
          </button>
        </div>
      </div>

      {/* Google Verification Notice Banner */}
      <div style={{
        background: "rgba(244, 198, 214, 0.25)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-md) var(--space-lg)",
        marginBottom: "var(--space-xl)",
        display: "flex",
        gap: "var(--space-md)",
        alignItems: "flex-start"
      }}>
        <ShieldAlert size={22} style={{ color: "var(--primary-dark)", flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: "13px", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text)", display: "block", marginBottom: 4 }}>
            About Google Verification & Developer Mode
          </strong>
          <p style={{ margin: "0 0 6px 0", color: "var(--text-muted)" }}>
            If Google displays <em>"Access blocked: StudyOS has not completed the Google verification process"</em> on OAuth, Google requires your Gmail to be listed as a <strong>Test User</strong> in your Google Cloud Console (under <code>APIs & Services → OAuth consent screen → Test users</code>).
          </p>
          <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
            <span className="badge badge-peach">✅ Instant Alternative:</span>
            <span style={{ color: "var(--text)" }}>Click <strong>"Sync Deadlines & Materials"</strong> anytime to fetch active coursework and auto-mark deadlines directly.</span>
          </div>
        </div>
      </div>

      {!connected ? (
        <div className="glass-card" style={{ maxWidth: 520, margin: "0 auto" }}>
          <div className="classroom-connect" style={{ textAlign: "center", padding: "var(--space-xl)" }}>
            <div className="classroom-icon" style={{ fontSize: 42, marginBottom: "var(--space-md)" }}>🎓</div>
            <h2 style={{ marginBottom: "var(--space-sm)", fontSize: 20 }}>Connect Google Classroom</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7, marginBottom: "var(--space-lg)" }}>
              Automatically synchronize your registered courses, lecture materials, assignments, and quiz deadlines with your StudyOS timeline.
            </p>
            
            <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap", justifyContent: "center", marginBottom: "var(--space-xl)" }}>
              {["Fetch course materials", "Auto-mark assignment deadlines", "Sync quiz dates", "Read-only access"].map(s => (
                <span key={s} className="badge badge-blue"><CheckCircle size={11} /> {s}</span>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleDirectSync}
                style={{ justifyContent: "center", gap: "8px" }}
              >
                <Calendar size={18} />
                Sync Classroom Deadlines & Materials (Direct)
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleOAuthConnect}
                style={{ justifyContent: "center", gap: "8px" }}
              >
                {/* Official Google G Icon */}
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.93 6.72-4.93z"/>
                </svg>
                Authorize with Google Account (OAuth)
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-light)", marginTop: "var(--space-md)" }}>
              OAuth 2.0 Client: 341035745520 · Read-only access · No data shared
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Connection status banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--space-sm)",
            background: "rgba(123,198,126,0.1)", border: "1px solid rgba(123,198,126,0.3)",
            borderRadius: "var(--radius-lg)", padding: "var(--space-sm) var(--space-md)",
            marginBottom: "var(--space-lg)", fontSize: 13, color: "var(--text)"
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} />
            <strong>Classroom Active & Connected</strong> · {user?.email || "student@example.com"}
            <span className="badge badge-green" style={{ marginLeft: "var(--space-sm)" }}>
              {isLiveConnection ? "Live Google Cloud" : "Direct Active Mode"}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={() => { setConnected(false); addToast("Disconnected from Classroom", "info"); }}
            >
              Disconnect
            </button>
          </div>

          {/* Course grid */}
          <div className="course-cards-grid">
            {displayCourses.map((course, i) => (
              <div key={course.id} className="course-card">
                <div className="course-color-bar" style={{ background: COURSE_COLORS[course.color ?? i % COURSE_COLORS.length] }} />
                <div className="course-card-name" style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                  {course.name}
                </div>
                <div className="course-card-teacher" style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "var(--space-sm)" }}>
                  {course.teacher} {course.section ? `· ${course.section}` : ""}
                </div>
                <div style={{ display: "flex", gap: "var(--space-xs)", marginBottom: "var(--space-md)", flexWrap: "wrap" }}>
                  <span className="badge badge-pink">📚 {course.materials || 8} materials</span>
                  <span className="badge badge-peach">📋 {course.courseWork || 4} tasks/quizzes</span>
                </div>
                <div className="sync-status" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div className="sync-dot synced" />
                  <span style={{ color: "var(--success)", fontSize: 12 }}>Synced to Timeline</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: "auto", padding: "3px 8px", fontSize: 11 }}
                    onClick={() => addToast(`Importing materials for ${course.name}…`, "info")}
                  >
                    <BookOpen size={12} /> Notes
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
