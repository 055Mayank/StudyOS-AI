import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import NotesTab from "./components/NotesTab.jsx";
import FlashcardsTab from "./components/FlashcardsTab.jsx";
import SummaryTab from "./components/SummaryTab.jsx";
import DeadlinesTab from "./components/DeadlinesTab.jsx";
import SettingsTab from "./components/SettingsTab.jsx";
import Toast from "./components/Toast.jsx";
import axios from "axios";

const API = "/api";

export default function App() {
  const [activeTab, setActiveTab] = useState("notes");
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [processingJobs, setProcessingJobs] = useState({});
  const [toasts, setToasts] = useState([]);
  const [user, setUser] = useState({ name: "Student", email: "student@example.com", authProvider: "local" });
  const pollIntervals = useRef({});

  // Dark mode
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // Handle URL redirect query parameters (OAuth callback & tokens)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const status = params.get("status");
    const email = params.get("email");
    const name = params.get("name");
    const picture = params.get("picture");
    const err = params.get("error");

    if (err) {
      addToast(`Authentication note: ${decodeURIComponent(err)}`, "error");
    }

    if (token) {
      localStorage.setItem("studyos_token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      const loggedUser = {
        name: name ? decodeURIComponent(name) : (email ? email.split("@")[0] : "Student"),
        email: email ? decodeURIComponent(email) : "student@example.com",
        picture: picture ? decodeURIComponent(picture) : null,
        authProvider: "google",
      };
      setUser(loggedUser);

      if (status === "classroom_connected") {
        addToast("Google Classroom connected! Check your Deadlines tab.", "success");
        setActiveTab("deadlines");
      } else {
        addToast(`Welcome, ${loggedUser.name}! Signed in with Google.`, "success");
      }

      window.history.replaceState({}, document.title, window.location.pathname);
      fetchUserData();
      fetchDocuments();
    } else {
      const savedToken = localStorage.getItem("studyos_token");
      if (savedToken) {
        axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
        fetchUserData();
      }
      fetchDocuments();
    }
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      if (res.data.user) {
        setUser(prev => ({ ...prev, ...res.data.user }));
      }
    } catch (e) {
      console.warn("User fetch notice:", e.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      addToast("Opening Google Sign-In…", "info");
      const res = await axios.get(`${API}/auth/google/login-url`);
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (e) {
      addToast("Google Sign-In unavailable: " + (e.response?.data?.error || e.message), "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("studyos_token");
    delete axios.defaults.headers.common["Authorization"];
    setUser({ name: "Student", email: "student@example.com", authProvider: "local" });
    addToast("Logged out of Google", "info");
    fetchDocuments();
  };

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API}/documents`);
      const docs = res.data.documents || [];
      setDocuments(docs);
      if (docs.length > 0 && !activeDocId) {
        setActiveDocId(docs[0].id);
      }
    } catch (err) {
      console.warn("[fetchDocuments] Could not load documents:", err.message);
      // Keep existing documents in state rather than replacing with mocks
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;

    // Client-side validation
    const MAX_SIZE_MB = 25;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      addToast(`File exceeds ${MAX_SIZE_MB}MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller file.`, "error");
      return;
    }

    const allowedExtensions = [".pdf", ".docx", ".txt", ".md", ".pptx", ".ppt"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      addToast(`Unsupported file type (${ext}). Allowed formats: PDF, DOCX, TXT, MD, PPTX.`, "error");
      return;
    }

    const jobId = `job-${Date.now()}`;
    const displayName = file.name;
    const tempDoc = { id: jobId, filename: file.name, displayName, originalName: file.name, status: "processing", courseTag: "General", source: "upload" };
    setDocuments(prev => [tempDoc, ...prev]);
    setActiveDocId(jobId);
    setProcessingJobs(prev => ({ ...prev, [jobId]: { status: "processing", filename: file.name } }));
    addToast(`Uploading ${file.name}…`, "info");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { jobId: serverJobId, documentId } = res.data;
      // Replace temp doc with real server documentId immediately
      if (documentId && documentId !== jobId) {
        setDocuments(prev => prev.map(d => d.id === jobId ? { ...d, id: documentId } : d));
        setActiveDocId(prev => prev === jobId ? documentId : prev);
      }
      pollJob(serverJobId || jobId, documentId || jobId, jobId);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      addToast(`Upload failed: ${errMsg}. Please try again.`, "error");
      // Remove the temp doc on failure
      setDocuments(prev => prev.filter(d => d.id !== jobId));
      setProcessingJobs(prev => { const n = { ...prev }; delete n[jobId]; return n; });
    }
  };

  const handleDeleteDocument = useCallback(async (docId) => {
    try {
      await axios.delete(`${API}/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (activeDocId === docId) {
        setActiveDocId(null);
      }
      addToast("Document deleted successfully", "success");
    } catch (err) {
      addToast("Failed to delete document: " + (err.response?.data?.error || err.message), "error");
    }
  }, [activeDocId, addToast]);

  const pollJob = (jobId, docId, tempJobId = null) => {
    const pollKey = jobId;
    pollIntervals.current[pollKey] = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/status/${jobId}`);
        if (res.data.status === "done") {
          clearInterval(pollIntervals.current[pollKey]);
          delete pollIntervals.current[pollKey];
          // Remove from processing jobs (both temp and server IDs)
          setProcessingJobs(prev => {
            const n = { ...prev };
            delete n[jobId];
            if (tempJobId) delete n[tempJobId];
            return n;
          });
          // Update status in documents array immediately so child tabs react instantly
          setDocuments(prev => prev.map(d => (d.id === docId || d.id === jobId || d.id === tempJobId) ? { ...d, id: docId, status: "done", processingStatus: "done" } : d));
          setActiveDocId(docId);
          addToast("✨ Document processed & ready!", "success");
          fetchDocuments();
        } else if (res.data.status === "failed") {
          clearInterval(pollIntervals.current[pollKey]);
          delete pollIntervals.current[pollKey];
          setProcessingJobs(prev => { const n = { ...prev }; delete n[jobId]; return n; });
          setDocuments(prev => prev.map(d => (d.id === docId || d.id === jobId || d.id === tempJobId) ? { ...d, id: docId, status: "failed", processingStatus: "failed" } : d));
          addToast("Processing notice: You can generate notes from the tab.", "info");
        }
      } catch {
        // Network error during poll — keep polling silently
      }
    }, 2000);
  };

  const tabComponents = {
    notes:      <NotesTab      activeDocId={activeDocId} documents={documents} addToast={addToast} />,
    flashcards: <FlashcardsTab activeDocId={activeDocId} documents={documents} addToast={addToast} />,
    summary:    <SummaryTab   activeDocId={activeDocId} documents={documents} addToast={addToast} />,
    deadlines:  <DeadlinesTab  addToast={addToast} />,
    settings:   <SettingsTab  user={user} setUser={setUser} darkMode={darkMode} setDarkMode={setDarkMode} addToast={addToast} onGoogleLogin={handleGoogleLogin} />,
  };

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
        onUpload={handleUpload}
        documents={documents}
        activeDocId={activeDocId}
        setActiveDocId={setActiveDocId}
        processingJobs={processingJobs}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onDeleteDocument={handleDeleteDocument}
      />

      <div className="main-content">
        <TopBar
          activeTab={activeTab}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onHamburger={() => setSidebarOpen(true)}
          user={user}
          documents={documents}
          activeDocId={activeDocId}
          setActiveDocId={setActiveDocId}
          onGoogleLogin={handleGoogleLogin}
          onLogout={handleLogout}
        />
        <div key={activeTab} className="tab-content">
          {tabComponents[activeTab]}
        </div>
      </div>

      <Toast toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}
