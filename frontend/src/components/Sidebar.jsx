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
      <div className="sidebar-nav" role="tablist" aria-label="Workspace navigation">
        {NAV_ITEMS.map(({ id, icon: Icon, label }, index) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            className={"nav-item " + (activeTab === id ? "active" : "")}
            onClick={() => setActiveTab(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                const next = NAV_ITEMS[(index + 1) % NAV_ITEMS.length].id;
                setActiveTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const prev = NAV_ITEMS[(index - 1 + NAV_ITEMS.length) % NAV_ITEMS.length].id;
                setActiveTab(prev);
                document.getElementById(`tab-${prev}`)?.focus();
              }
            }}
            aria-label={label}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
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
          <div className="doc-list" role="list" aria-label="Uploaded documents">
            {documents.map(doc => {
              const name = doc.displayName || doc.originalName || doc.filename;
              const isDone = doc.status === "done" || doc.processingStatus === "done";
              const isConfirming = confirmDelete === doc.id;
              return (
                <div
                  key={doc.id}
                  className={"doc-item " + (doc.id === activeDocId ? "active" : "")}
                  onClick={() => setActiveDocId(doc.id)}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`Select document ${name}`}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveDocId(doc.id)}
                  style={{ position: "relative" }}
                >
                  {!isDone ? (
                    <Loader size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0, color: "var(--pink-deep)" }} aria-hidden="true" />
                  ) : (
                    <CheckCircle size={12} style={{ color: "var(--success)", flexShrink: 0 }} aria-hidden="true" />
                  )}
                  <span className="doc-item-name" title={name}>{name}</span>
                  <button
                    onClick={(e) => handleDeleteClick(e, doc.id)}
                    title={isConfirming ? "Click again to confirm" : `Delete ${name}`}
                    aria-label={isConfirming ? `Confirm deletion of ${name}` : `Delete document ${name}`}
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
                    {isConfirming ? "Confirm?" : <Trash2 size={10} aria-hidden="true" />}
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
          id="tab-settings"
          role="tab"
          aria-selected={activeTab === "settings"}
          aria-controls="panel-settings"
          className={"nav-item " + (activeTab === "settings" ? "active" : "")}
          onClick={() => setActiveTab("settings")}
          aria-label="Settings"
        >
          <Settings size={17} strokeWidth={1.8} aria-hidden="true" />
          Settings
        </button>
      </div>
    </nav>
  );
}
