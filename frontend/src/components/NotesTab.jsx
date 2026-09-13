import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, BookOpen, RefreshCw, AlertCircle, FileQuestion, Loader } from "lucide-react";
import axios from "axios";
import { getLocalDocumentData, saveLocalDocumentData, buildDeterministicContentClient } from "../services/clientWorkspace.js";

function SkeletonNotes() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="notes-section">
          <div style={{ padding: "var(--space-md) var(--space-lg)" }}>
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-text wide" />
            <div className="skeleton skeleton-text mid" />
            <div className="skeleton skeleton-text wide" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NoteSection({ section, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  const renderBody = (body, keyTerms = []) => {
    if (!Array.isArray(body)) return <span>{typeof body === "string" ? body : JSON.stringify(body)}</span>;
    return body.map((chunk, i) => {
      if (chunk.terms?.some(t => keyTerms.includes(t))) {
        return <span key={i} className="key-term">{chunk.text}</span>;
      }
      return <span key={i}>{chunk.text}</span>;
    });
  };

  return (
    <div className="notes-section">
      <button
        className="notes-section-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          {open ? <ChevronDown size={16} strokeWidth={1.8} /> : <ChevronRight size={16} strokeWidth={1.8} />}
          {section.heading}
        </span>
        {section.ref && (
          <span className="source-ref" aria-label={`Source: ${section.ref}`}>
            {section.ref}
          </span>
        )}
      </button>
      {open && (
        <div className="notes-section-body">
          <p style={{ marginBottom: "var(--space-sm)", lineHeight: 1.7 }}>
            {renderBody(section.body, section.keyTerms)}
          </p>
          {section.keyTerms?.length > 0 && (
            <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap", marginTop: "var(--space-sm)" }}>
              <span style={{ fontSize: "12px", color: "var(--text-light)" }}>Key terms:</span>
              {section.keyTerms.map(t => (
                <span key={t} className="badge badge-pink">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NotesTab({ activeDocId, documents, addToast }) {
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const activeDoc = documents.find(d => d.id === activeDocId);
  const displayName = activeDoc?.displayName || activeDoc?.originalName || activeDoc?.filename || "Selected Lecture";
  const isProcessing = activeDoc && (activeDoc.status === "processing" || activeDoc.processingStatus === "processing" || activeDoc.status === "pending");

  useEffect(() => {
    if (!activeDocId) {
      setNotes(null);
      setError(null);
      return;
    }
    const doc = documents.find(d => d.id === activeDocId);
    const isDone = doc?.status === "done" || doc?.processingStatus === "done";
    if (isDone) {
      // Auto-load as soon as document processing completes
      loadNotes();
    } else {
      // Document is still processing — clear stale notes
      setNotes(null);
      setError(null);
    }
  }, [activeDocId, activeDoc?.status, activeDoc?.processingStatus]);

  const loadNotes = async (force = false) => {
    if (!activeDocId) return;
    setLoading(true);
    setError(null);

    // 1. Fast local check (instant render)
    if (!force) {
      const localNotes = getLocalDocumentData(activeDocId, "notes");
      if (localNotes && localNotes.length > 0) {
        setNotes(localNotes);
        setLoading(false);
        return;
      }
    }

    // 2. Try backend endpoint
    try {
      const res = await axios.post("/api/generate/notes", { documentId: activeDocId, force }, { timeout: 4000 });
      if (res.data?.notes && res.data.notes.length > 0) {
        setNotes(res.data.notes);
        saveLocalDocumentData(activeDocId, "notes", res.data.notes);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.info("Backend notes endpoint notice, falling back to local workspace data");
    }

    // 3. Fallback: check local storage or generate on the fly
    const localNotes = getLocalDocumentData(activeDocId, "notes");
    if (localNotes && localNotes.length > 0) {
      setNotes(localNotes);
    } else if (activeDoc?.rawText || activeDoc?.sections) {
      const generated = buildDeterministicContentClient({
        rawText: activeDoc.rawText || "",
        sections: activeDoc.sections || [],
      }, activeDoc.courseTag || "General");
      setNotes(generated.notes);
      saveLocalDocumentData(activeDocId, "notes", generated.notes);
    } else {
      setNotes([]);
    }
    setLoading(false);
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    await loadNotes(true); // force=true busts the cache
    setGenerating(false);
  };

  if (!activeDocId || documents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <BookOpen size={36} strokeWidth={1.5} />
        </div>
        <h2>No document selected</h2>
        <p>Upload a lecture file from the sidebar to generate AI revision notes.</p>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div>
        <div className="tab-header">
          <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <BookOpen size={20} strokeWidth={1.8} />
            Revision Notes
          </h1>
          <p>Analyzing and synthesizing <strong>{displayName}</strong></p>
        </div>
        <div className="empty-state" style={{ padding: "var(--space-2xl) var(--space-xl)" }}>
          <div className="empty-state-icon" style={{ animation: "pulse 1.8s ease-in-out infinite" }}>
            <Loader size={36} strokeWidth={1.5} style={{ animation: "spin 1.2s linear infinite", color: "var(--pink-deep)" }} />
          </div>
          <h2>Processing Lecture Material...</h2>
          <p>Extracting key concepts, structured headings, and revision notes. This will take just a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="tab-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-md)" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <BookOpen size={20} strokeWidth={1.8} />
            Revision Notes
          </h1>
          <p>
            {displayName} · {activeDoc?.courseTag || "General"}
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleRegenerate}
          disabled={generating || loading}
        >
          <RefreshCw size={14} strokeWidth={1.8} style={{ animation: (generating || loading) ? "spin 1s linear infinite" : "none" }} />
          Regenerate Notes
        </button>
      </div>

      {loading ? (
        <SkeletonNotes />
      ) : error ? (
        <div style={{
          padding: "var(--space-xl)",
          background: "var(--surface)",
          border: "1px solid rgba(232,123,123,0.3)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "var(--space-md)"
        }}>
          <AlertCircle size={32} color="var(--error)" strokeWidth={1.75} />
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>
              Failed to generate notes
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "480px", margin: 0 }}>
              {error}
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => loadNotes()}>
            <RefreshCw size={14} strokeWidth={1.8} />
            Try Again
          </button>
        </div>
      ) : notes && notes.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {notes.map((section, i) => (
            <NoteSection key={i} section={section} defaultOpen={i === 0} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileQuestion size={36} strokeWidth={1.5} />
          </div>
          <h2>No notes generated yet</h2>
          <p>Click below to generate revision notes for <strong>{displayName}</strong>.</p>
          <button className="btn btn-primary btn-sm" onClick={() => loadNotes()} style={{ marginTop: "var(--space-md)" }}>
            <BookOpen size={15} strokeWidth={1.8} />
            Generate Notes
          </button>
        </div>
      )}
    </div>
  );
}
