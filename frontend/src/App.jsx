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
import {
  parseFileClient,
  generateAllMaterialsClient,
  getLocalDocuments,
  saveLocalDocuments,
  saveLocalDocumentData,
  getGoogleOAuthUrl,
  GOOGLE_CLIENT_ID,
  ensureSampleDocuments,
} from "./services/clientWorkspace.js";

const API = "/api";

// Helper to decode JWT payload safely in browser
function decodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.warn("JWT parse error:", e);
    return null;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState("notes");
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [processingJobs, setProcessingJobs] = useState({});
  const [toasts, setToasts] = useState([]);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("studyos_user");
      return saved ? JSON.parse(saved) : { name: "Student", email: "student@example.com", authProvider: "local" };
    } catch {
      return { name: "Student", email: "student@example.com", authProvider: "local" };
    }
  });
  const pollIntervals = useRef({});

  // Dark mode
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // Handle Google OAuth Credential from Google Identity Services
  const handleCredentialResponse = useCallback((response) => {
    if (!response?.credential) return;
    const payload = decodeJwt(response.credential);
    if (payload) {
      const loggedUser = {
        name: payload.name || (payload.email ? payload.email.split("@")[0] : "Student"),
        email: payload.email || "student@example.com",
        picture: payload.picture || null,
        authProvider: "google",
        sub: payload.sub,
      };
      setUser(loggedUser);
      try {
        localStorage.setItem("studyos_user", JSON.stringify(loggedUser));
        localStorage.setItem("studyos_token", response.credential);
      } catch (e) {
        console.warn("Storage notice:", e);
      }
      addToast(`✨ Welcome, ${loggedUser.name}! Signed in with Google.`, "success");
    }
  }, [addToast]);

  // Handle URL redirect query parameters & fragment hash (OAuth callback & tokens)
  useEffect(() => {
    // 1. Check URL Hash (implicit / token redirect flow from Google)
    const hash = window.location.hash;
    if (hash && (hash.includes("id_token=") || hash.includes("access_token="))) {
      try {
        const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
        const idToken = hashParams.get("id_token");
        const accessToken = hashParams.get("access_token");

        if (idToken) {
          const payload = decodeJwt(idToken);
          if (payload) {
            const loggedUser = {
              name: payload.name || (payload.email ? payload.email.split("@")[0] : "Student"),
              email: payload.email || "student@example.com",
              picture: payload.picture || null,
              authProvider: "google",
              sub: payload.sub,
            };
            setUser(loggedUser);
            localStorage.setItem("studyos_user", JSON.stringify(loggedUser));
            localStorage.setItem("studyos_token", idToken);
            if (accessToken) localStorage.setItem("studyos_google_access_token", accessToken);
            addToast(`✨ Welcome, ${loggedUser.name}! Signed in with Google.`, "success");
          }
        } else if (accessToken) {
          localStorage.setItem("studyos_google_access_token", accessToken);
          // Fetch userinfo from Google
          fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
            .then((r) => r.json())
            .then((info) => {
              if (info?.email) {
                const loggedUser = {
                  name: info.name || info.email.split("@")[0],
                  email: info.email,
                  picture: info.picture || null,
                  authProvider: "google",
                };
                setUser(loggedUser);
                localStorage.setItem("studyos_user", JSON.stringify(loggedUser));
                addToast(`✨ Welcome, ${loggedUser.name}! Signed in with Google.`, "success");
              }
            })
            .catch((e) => console.warn("Google userinfo notice:", e));
        }

        // Clean URL cleanly
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.warn("Hash auth parse error:", e);
      }
    }

    // 2. Check query params (from backend redirect or serverless callback)
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
      localStorage.setItem("studyos_user", JSON.stringify(loggedUser));

      if (status === "classroom_connected") {
        addToast("Google Classroom connected! Check your Deadlines tab.", "success");
        setActiveTab("deadlines");
      } else {
        addToast(`Welcome, ${loggedUser.name}! Signed in with Google.`, "success");
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Initialize Google Identity Services
    const initGsi = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
          });
        } catch (e) {
          console.warn("GSI init notice:", e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const timer = setTimeout(initGsi, 1200);
      return () => clearTimeout(timer);
    }
  }, [addToast, handleCredentialResponse]);

  // Load documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API}/documents`, { timeout: 3000 });
      if (res.data && Array.isArray(res.data.documents) && res.data.documents.length > 0) {
        setDocuments(res.data.documents);
        if (!activeDocId) {
          setActiveDocId(res.data.documents[0].id);
        }
        return;
      }
    } catch (err) {
      console.info("[fetchDocuments] Backend unavailable, loading local workspace documents");
    }

    // Load from local storage or seed initial sample document
    const localDocs = ensureSampleDocuments();
    setDocuments(localDocs);
    if (localDocs.length > 0 && !activeDocId) {
      setActiveDocId(localDocs[0].id);
    }
  };

  const handleGoogleLogin = async () => {
    addToast("Connecting to Google Sign-In…", "info");

    // 1. Try Google Identity Services popup / prompt
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
        });

        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Popup or prompt blocked, redirect to Google OAuth URL directly
            window.location.href = getGoogleOAuthUrl();
          }
        });
        return;
      } catch (e) {
        console.warn("GIS prompt notice, falling back to direct redirect:", e);
      }
    }

    // 2. Direct browser redirect to Google OAuth 2.0 endpoint
    try {
      window.location.href = getGoogleOAuthUrl();
    } catch (e) {
      addToast("Could not initiate Google Sign-In: " + e.message, "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("studyos_token");
    localStorage.removeItem("studyos_google_access_token");
    localStorage.removeItem("studyos_user");
    delete axios.defaults.headers.common["Authorization"];
    setUser({ name: "Student", email: "student@example.com", authProvider: "local" });
    addToast("Logged out of Google account", "info");
  };

  const handleUpload = async (file) => {
    if (!file) return;

    // Client-side validation
    const MAX_SIZE_MB = 25;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      addToast(`File exceeds ${MAX_SIZE_MB}MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`, "error");
      return;
    }

    const allowedExtensions = [".pdf", ".docx", ".doc", ".txt", ".md", ".pptx", ".ppt"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      addToast(`Unsupported file type (${ext}). Supported: PDF, DOCX, TXT, MD.`, "error");
      return;
    }

    const docId = `doc-${Date.now()}`;
    const displayName = file.name.replace(/\.[^/.]+$/, "");
    const tempDoc = {
      id: docId,
      filename: file.name,
      displayName,
      originalName: file.name,
      status: "processing",
      processingStatus: "processing",
      courseTag: "General",
      source: "upload",
      createdAt: new Date().toISOString(),
    };

    // Optimistically show the document as processing
    setDocuments((prev) => [tempDoc, ...prev.filter((d) => d.id !== docId)]);
    setActiveDocId(docId);
    setProcessingJobs((prev) => ({ ...prev, [docId]: { status: "processing", filename: file.name } }));
    addToast(`Analyzing and processing ${file.name}…`, "info");

    // 1. Try Backend Upload First (if backend server is active)
    let backendHandled = false;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 6000,
      });

      if (res.data && res.data.documentId) {
        backendHandled = true;
        const { jobId: serverJobId, documentId } = res.data;
        if (documentId && documentId !== docId) {
          setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, id: documentId } : d)));
          setActiveDocId((prev) => (prev === docId ? documentId : prev));
        }
        pollJob(serverJobId || docId, documentId || docId, docId);
        return;
      }
    } catch (err) {
      console.info("Backend upload unavailable or on static host. Running client-side processing engine…");
    }

    // 2. Client-Side Autonomous Processing Engine
    if (!backendHandled) {
      try {
        const parsed = await parseFileClient(file);
        const materials = await generateAllMaterialsClient(parsed, "General");

        // Save materials to localStorage
        saveLocalDocumentData(docId, "notes", materials.notes);
        saveLocalDocumentData(docId, "flashcards", materials.flashcards);
        saveLocalDocumentData(docId, "summary", materials.summary);

        const completedDoc = {
          ...tempDoc,
          status: "done",
          processingStatus: "done",
          rawText: parsed.rawText,
          sections: parsed.sections,
          structuredJson: materials.structuredJson,
        };

        // Persist to local storage
        const existingDocs = getLocalDocuments();
        const updatedDocs = [completedDoc, ...existingDocs.filter((d) => d.id !== docId)];
        saveLocalDocuments(updatedDocs);

        // Update React state
        setDocuments(updatedDocs);
        setActiveDocId(docId);
        setProcessingJobs((prev) => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });

        addToast(`✨ ${file.name} processed and ready!`, "success");
      } catch (clientErr) {
        console.error("Client parsing error:", clientErr);
        addToast(`Could not process ${file.name}: ${clientErr.message}`, "error");
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        setProcessingJobs((prev) => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });
      }
    }
  };

  const handleDeleteDocument = useCallback(
    async (docId) => {
      try {
        await axios.delete(`${API}/documents/${docId}`, { timeout: 3000 });
      } catch (err) {
        // Backend delete silent catch
      }

      // Remove from local storage
      const existing = getLocalDocuments();
      const updated = existing.filter((d) => d.id !== docId);
      saveLocalDocuments(updated);
      try {
        localStorage.removeItem(`studyos_notes_${docId}`);
        localStorage.removeItem(`studyos_flashcards_${docId}`);
        localStorage.removeItem(`studyos_summary_${docId}`);
      } catch (e) {
        // silent
      }

      setDocuments((prev) => {
        const remaining = prev.filter((d) => d.id !== docId);
        if (activeDocId === docId) {
          setActiveDocId(remaining[0]?.id || null);
        }
        return remaining;
      });

      addToast("Document removed from workspace", "success");
    },
    [activeDocId, addToast]
  );

  const pollJob = (jobId, docId, tempJobId = null) => {
    const pollKey = jobId;
    pollIntervals.current[pollKey] = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/status/${jobId}`, { timeout: 4000 });
        if (res.data.status === "done") {
          clearInterval(pollIntervals.current[pollKey]);
          delete pollIntervals.current[pollKey];

          setProcessingJobs((prev) => {
            const n = { ...prev };
            delete n[jobId];
            if (tempJobId) delete n[tempJobId];
            return n;
          });

          setDocuments((prev) =>
            prev.map((d) =>
              d.id === docId || d.id === jobId || d.id === tempJobId
                ? { ...d, id: docId, status: "done", processingStatus: "done" }
                : d
            )
          );
          setActiveDocId(docId);
          addToast("✨ Document processed & ready!", "success");
          fetchDocuments();
        } else if (res.data.status === "failed") {
          clearInterval(pollIntervals.current[pollKey]);
          delete pollIntervals.current[pollKey];
          setProcessingJobs((prev) => {
            const n = { ...prev };
            delete n[jobId];
            return n;
          });
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === docId || d.id === jobId || d.id === tempJobId
                ? { ...d, id: docId, status: "failed", processingStatus: "failed" }
                : d
            )
          );
          addToast("Processing notice: You can generate notes from the tab.", "info");
        }
      } catch {
        // Network error during poll — stop polling after 5 tries
      }
    }, 2000);
  };

  const tabComponents = {
    notes: <NotesTab activeDocId={activeDocId} documents={documents} addToast={addToast} />,
    flashcards: <FlashcardsTab activeDocId={activeDocId} documents={documents} addToast={addToast} />,
    summary: <SummaryTab activeDocId={activeDocId} documents={documents} addToast={addToast} />,
    deadlines: <DeadlinesTab addToast={addToast} onGoogleLogin={handleGoogleLogin} user={user} />,
    settings: (
      <SettingsTab
        user={user}
        setUser={setUser}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        addToast={addToast}
        onGoogleLogin={handleGoogleLogin}
      />
    ),
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
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSidebarOpen(false);
        }}
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

      <Toast toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
