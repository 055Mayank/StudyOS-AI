import { useRef, useState } from "react";
import {
  BookOpen, Layers, FileText, Calendar, Settings,
  Upload, Loader, CheckCircle, Trash2, BookMarked, UploadCloud, X
} from "lucide-react";

const NAV_ITEMS = [
  { id: "notes",      icon: BookOpen,  label: "Notes" },
  { id: "flashcards", icon: Layers,    label: "Flashcards" },
  { id: "summary",    icon: FileText,  label: "Summary" },
  { id: "deadlines",  icon: Calendar,  label: "Deadlines" },
];

export default function Sidebar({
  activeTab, setActiveTab, onUpload, documents,
  activeDocId, setActiveDocId, processingJobs, isOpen, onDeleteDocument
}) {
  const fileInputRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-active");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-active");
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove("drag-active");
  };

  const handleFile = (file) => {
    if (file.name.match(/\.(pdf|docx|pptx|doc|txt|md)$/i)) {
      onUpload(file);
    }
  };

  const handleDeleteClick = (e, docId) => {
    e.stopPropagation();
    if (confirmDelete === docId) {
      onDeleteDocument?.(docId);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(docId);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const processingList = Object.entries(processingJobs);

  return (
    <nav className={"sidebar " + (isOpen ? "open" : "")} aria-label="Main navigation">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <BookMarked size={18} strokeWidth={1.8} style={{ color: "var(--pink-deep)" }} />
        </div>
        <div className="sidebar-logo-text">
          StudyAI
          <span>AI Student Workspace</span>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className="upload-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload lecture material (PDF, DOCX, PPTX, TXT)"
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
      >
        <div className="upload-zone-icon">
          <UploadCloud size={22} strokeWidth={1.6} style={{ color: "var(--pink-deep)" }} />
        </div>
        <p>
          <strong>Drop file to upload</strong>
          PDF, DOCX, PPTX or TXT
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.doc,.txt,.md"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
            e.target.value = "";
          }}
        />
      </div>

      {/* Processing indicators */}
      {processingList.map(([id, job]) => (
        <div key={id} className="upload-status-bar">
          <Loader size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0, color: "var(--pink-deep)" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
            {job.filename}
          </span>
        </div>
      ))}

      {/* Divider */}
      <div className="nav-divider" />

      {/* Primary Navigation — 4 tabs */}
      <div className="sidebar-nav">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={"nav-item " + (activeTab === id ? "active" : "")}
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? "page" : undefined}
            aria-label={label}
          >
            <Icon size={17} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>

      {/* Documents list */}
      {documents.length > 0 && (
        <>
          <div className="nav-divider" />
          <div style={{ padding: "0 12px 6px", fontSize: "10px", color: "var(--text-light)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Documents
          </div>
          <div className="doc-list">
            {documents.map(doc => {
              const name = doc.displayName || doc.originalName || doc.filename;
              const isDone = doc.status === "done" || doc.processingStatus === "done";
              const isConfirming = confirmDelete === doc.id;
              return (
                <div
                  key={doc.id}
                  className={"doc-item " + (doc.id === activeDocId ? "active" : "")}
                  onClick={() => setActiveDocId(doc.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setActiveDocId(doc.id)}
                  style={{ position: "relative" }}
                >
                  {!isDone ? (
                    <Loader size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0, color: "var(--pink-deep)" }} />
                  ) : (
                    <CheckCircle size={12} style={{ color: "var(--success)", flexShrink: 0 }} />
                  )}
                  <span className="doc-item-name" title={name}>{name}</span>
                  <button
                    onClick={(e) => handleDeleteClick(e, doc.id)}
                    title={isConfirming ? "Click again to confirm" : "Delete document"}
                    aria-label="Delete document"
                    style={{
                      marginLeft: "auto", flexShrink: 0,
                      background: isConfirming ? "rgba(232,123,123,0.15)" : "transparent",
                      border: "none", padding: "2px 4px",
                      borderRadius: "var(--radius-sm)", cursor: "pointer",
                      color: isConfirming ? "var(--error)" : "var(--text-light)",
                      display: "flex", alignItems: "center",
                      transition: "color 0.15s",
                      fontSize: 9,
                    }}
                    onMouseEnter={e => { if (!isConfirming) e.currentTarget.style.color = "var(--error)"; }}
                    onMouseLeave={e => { if (!isConfirming) e.currentTarget.style.color = "var(--text-light)"; }}
                  >
                    {isConfirming ? "Confirm?" : <Trash2 size={10} />}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Settings at bottom */}
      <div className="nav-divider" />
      <div style={{ padding: "var(--space-sm)" }}>
        <button
          className={"nav-item " + (activeTab === "settings" ? "active" : "")}
          onClick={() => setActiveTab("settings")}
          aria-label="Settings"
        >
          <Settings size={17} strokeWidth={1.8} />
          Settings
        </button>
      </div>
    </nav>
  );
}
