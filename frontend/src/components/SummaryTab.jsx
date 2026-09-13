import { useState, useEffect } from "react";
import { FileText, RefreshCw, Copy, Check, CheckSquare, Square, AlertCircle, FileQuestion, Loader } from "lucide-react";
import axios from "axios";

export default function SummaryTab({ activeDocId, documents, addToast }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actions, setActions] = useState([]);
  const [error, setError] = useState(null);

  const activeDoc = documents.find(d => d.id === activeDocId);
  const displayName = activeDoc?.displayName || activeDoc?.originalName || activeDoc?.filename || "Selected Lecture";
  const isProcessing = activeDoc && (activeDoc.status === "processing" || activeDoc.processingStatus === "processing" || activeDoc.status === "pending");

  useEffect(() => {
    if (!activeDocId) {
      setSummary(null);
      setError(null);
      return;
    }
    const doc = documents.find(d => d.id === activeDocId);
    const isDone = doc?.status === "done" || doc?.processingStatus === "done";
    if (isDone) {
      loadSummary();
    } else {
      setSummary(null);
      setError(null);
    }
  }, [activeDocId, activeDoc?.status, activeDoc?.processingStatus]);

  const loadSummary = async (force = false) => {
    if (!activeDocId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post("/api/generate/summary", { documentId: activeDocId, force });
      if (res.data?.summary) {
        setSummary(res.data.summary);
        setActions(res.data.summary.actionItems || []);
      } else {
        setSummary(null);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to generate summary.";
      setError(msg);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    await loadSummary(true); // force=true busts the cache
    setGenerating(false);
  };

  const copyTakeaways = () => {
    if (!summary?.takeaways) return;
    const text = summary.takeaways.map((t, i) => `${i + 1}. ${t}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    addToast("Key takeaways copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleAction = (index) => {
    setActions(prev => prev.map((a, i) => i === index ? { ...a, done: !a.done } : a));
  };

  if (!activeDocId || documents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <FileText size={36} strokeWidth={1.5} />
        </div>
        <h2>No document selected</h2>
        <p>Upload a lecture file from the sidebar to generate a one-glance summary.</p>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div>
        <div className="tab-header">
          <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <FileText size={20} strokeWidth={1.8} />
            One-Glance Summary
          </h1>
          <p>Generating high-impact summary for <strong>{displayName}</strong></p>
        </div>
        <div className="empty-state" style={{ padding: "var(--space-2xl) var(--space-xl)" }}>
          <div className="empty-state-icon" style={{ animation: "pulse 1.8s ease-in-out infinite" }}>
            <Loader size={36} strokeWidth={1.5} style={{ animation: "spin 1.2s linear infinite", color: "var(--pink-deep)" }} />
          </div>
          <h2>Processing Lecture Material...</h2>
          <p>Extracting key takeaways, TL;DR overview, and action items. This will be ready in a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="tab-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-md)" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <FileText size={20} strokeWidth={1.8} />
            One-Glance Summary
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
          Regenerate Summary
        </button>
      </div>

      {loading ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 280,
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          gap: "var(--space-md)",
        }}>
          <RefreshCw size={28} strokeWidth={1.8} style={{ animation: "spin 1s linear infinite", color: "var(--primary-dark)" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Synthesizing summary for {displayName}…</p>
        </div>
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
              Failed to generate summary
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "480px", margin: 0 }}>
              {error}
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => loadSummary()}>
            <RefreshCw size={14} strokeWidth={1.8} />
            Try Again
          </button>
        </div>
      ) : summary ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {/* TL;DR Section */}
          <div className="summary-card" style={{
            background: "var(--surface-cream)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-lg)",
          }}>
            <h3 style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary-dark)", marginBottom: "var(--space-xs)" }}>
              TL;DR Executive Overview
            </h3>
            <p style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--text)", margin: 0 }}>
              {summary.tldr}
            </p>
          </div>

          {/* Key Takeaways */}
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-lg)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>Key Takeaways</h3>
              <button className="btn btn-ghost btn-sm" onClick={copyTakeaways}>
                {copied ? <Check size={14} strokeWidth={1.8} color="var(--success)" /> : <Copy size={14} strokeWidth={1.8} />}
                {copied ? "Copied" : "Copy Takeaways"}
              </button>
            </div>
            <ul style={{ paddingLeft: "var(--space-lg)", margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {(summary.takeaways || []).map((point, i) => (
                <li key={i} style={{ lineHeight: 1.6, color: "var(--text)" }}>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Action Items */}
          {actions.length > 0 && (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-lg)",
            }}>
              <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "var(--space-md)" }}>Recommended Action Items</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {actions.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => toggleAction(i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      cursor: "pointer",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-sm)",
                      background: item.done ? "var(--surface-cream)" : "transparent",
                    }}
                  >
                    {item.done ? (
                      <CheckSquare size={16} color="var(--success)" strokeWidth={1.8} />
                    ) : (
                      <Square size={16} color="var(--text-light)" strokeWidth={1.8} />
                    )}
                    <span style={{
                      fontSize: "14px",
                      color: item.done ? "var(--text-muted)" : "var(--text)",
                      textDecoration: item.done ? "line-through" : "none",
                    }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileQuestion size={36} strokeWidth={1.5} />
          </div>
          <h2>No summary generated yet</h2>
          <p>Click below to generate a one-glance summary for <strong>{displayName}</strong>.</p>
          <button className="btn btn-primary btn-sm" onClick={() => loadSummary()} style={{ marginTop: "var(--space-md)" }}>
            <FileText size={15} strokeWidth={1.8} />
            Generate Summary
          </button>
        </div>
      )}
    </div>
  );
}
