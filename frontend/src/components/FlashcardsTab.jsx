import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Layers, RotateCcw, AlertCircle, FileQuestion, Loader } from "lucide-react";
import axios from "axios";

export default function FlashcardsTab({ activeDocId, documents, addToast }) {
  const [cards, setCards] = useState([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [ratings, setRatings] = useState({});
  const [error, setError] = useState(null);

  const activeDoc = documents.find(d => d.id === activeDocId);
  const displayName = activeDoc?.displayName || activeDoc?.originalName || activeDoc?.filename || "Selected Lecture";
  const isProcessing = activeDoc && (activeDoc.status === "processing" || activeDoc.processingStatus === "processing" || activeDoc.status === "pending");

  useEffect(() => {
    if (!activeDocId) {
      setCards([]);
      setError(null);
      return;
    }
    const doc = documents.find(d => d.id === activeDocId);
    const isDone = doc?.status === "done" || doc?.processingStatus === "done";
    if (isDone) {
      loadCards();
    } else {
      setCards([]);
      setError(null);
    }
  }, [activeDocId, activeDoc?.status, activeDoc?.processingStatus]);

  // Keyboard navigation: arrow keys and space to flip
  useEffect(() => {
    const handler = (e) => {
      if (!cards.length) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") {
        e.preventDefault();
        setFlipped(f => !f);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, cards]);

  const loadCards = async (force = false) => {
    if (!activeDocId) return;
    setLoading(true);
    setError(null);
    setFlipped(false);
    setCurrent(0);

    try {
      const res = await axios.post("/api/generate/flashcards", { documentId: activeDocId, force });
      if (res.data?.flashcards && res.data.flashcards.length > 0) {
        setCards(res.data.flashcards);
      } else {
        setCards([]);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to generate flashcards.";
      setError(msg);
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    await loadCards(true); // force=true busts the cache
    setGenerating(false);
  };

  const next = () => {
    setFlipped(false);
    setCurrent(c => (c + 1) % cards.length);
  };

  const prev = () => {
    setFlipped(false);
    setCurrent(c => (c - 1 + cards.length) % cards.length);
  };

  const rate = (level) => {
    setRatings(prev => ({ ...prev, [current]: level }));
    next();
  };

  if (!activeDocId || documents.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Layers size={36} strokeWidth={1.5} />
        </div>
        <h2>No document selected</h2>
        <p>Upload a lecture file from the sidebar to generate study flashcards.</p>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div>
        <div className="tab-header">
          <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <Layers size={20} strokeWidth={1.8} />
            Flashcards
          </h1>
          <p>Synthesizing flashcards for <strong>{displayName}</strong></p>
        </div>
        <div className="empty-state" style={{ padding: "var(--space-2xl) var(--space-xl)" }}>
          <div className="empty-state-icon" style={{ animation: "pulse 1.8s ease-in-out infinite" }}>
            <Loader size={36} strokeWidth={1.5} style={{ animation: "spin 1.2s linear infinite", color: "var(--pink-deep)" }} />
          </div>
          <h2>Processing Lecture Material...</h2>
          <p>Extracting high-yield study flashcards from your material. This will be ready in a moment.</p>
        </div>
      </div>
    );
  }

  const currentCard = cards[current];
  const progressPercent = cards.length ? Math.round(((current + 1) / cards.length) * 100) : 0;

  return (
    <div>
      <div className="tab-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-md)" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <Layers size={20} strokeWidth={1.8} />
            Flashcards
          </h1>
          <p>
            {displayName} · {cards.length ? `${cards.length} cards generated` : "Interactive review"}
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleRegenerate}
          disabled={generating || loading}
        >
          <RefreshCw size={14} strokeWidth={1.8} style={{ animation: (generating || loading) ? "spin 1s linear infinite" : "none" }} />
          Regenerate Cards
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
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Synthesizing flashcards for {displayName}…</p>
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
              Failed to generate flashcards
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "480px", margin: 0 }}>
              {error}
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => loadCards()}>
            <RefreshCw size={14} strokeWidth={1.8} />
            Try Again
          </button>
        </div>
      ) : cards && cards.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-lg)" }}>
          {/* Progress bar */}
          <div style={{ width: "100%", maxWidth: 640 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
              <span>Card {current + 1} of {cards.length}</span>
              <span>{progressPercent}% completed</span>
            </div>
            <div style={{ width: "100%", height: 6, background: "var(--border)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              <div style={{ width: `${progressPercent}%`, height: "100%", background: "var(--primary)", transition: "width 0.3s ease" }} />
            </div>
          </div>

          {/* Flashcard container */}
          <div
            className="flashcard-container"
            onClick={() => setFlipped(!flipped)}
            role="button"
            tabIndex={0}
            aria-label="Flip flashcard"
            onKeyDown={(e) => e.key === "Enter" && setFlipped(!flipped)}
            style={{ width: "100%", maxWidth: 640, minHeight: 240, cursor: "pointer", perspective: "1000px" }}
          >
            <div className={`flashcard ${flipped ? "flipped" : ""}`} style={{
              background: flipped ? "var(--surface-cream)" : "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-xl)",
              minHeight: 240,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
              boxShadow: "var(--shadow-md)",
              position: "relative",
              transition: "transform 0.4s ease, background 0.3s ease",
            }}>
              <span style={{ position: "absolute", top: 16, right: 16, fontSize: 11, color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {flipped ? "Answer" : "Question"} · Click or Space to flip
              </span>

              <div style={{ fontSize: flipped ? 16 : 18, fontWeight: flipped ? 400 : 600, lineHeight: 1.6, color: "var(--text)", maxWidth: 520 }}>
                {flipped ? currentCard.back : currentCard.front}
              </div>
            </div>
          </div>

          {/* Navigation & rating controls */}
          <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <button className="btn btn-secondary" onClick={prev} aria-label="Previous card">
              <ChevronLeft size={18} strokeWidth={1.8} />
            </button>

            <button className="btn btn-secondary btn-sm" onClick={() => rate("hard")} style={{ borderColor: "rgba(232,123,123,0.4)" }}>
              Hard
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => rate("good")} style={{ borderColor: "rgba(244,198,214,0.6)" }}>
              Good
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => rate("easy")} style={{ borderColor: "rgba(123,198,126,0.4)" }}>
              Easy
            </button>

            <button className="btn btn-secondary" onClick={next} aria-label="Next card">
              <ChevronRight size={18} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileQuestion size={36} strokeWidth={1.5} />
          </div>
          <h2>No flashcards generated yet</h2>
          <p>Click below to generate high-yield flashcards for <strong>{displayName}</strong>.</p>
          <button className="btn btn-primary btn-sm" onClick={() => loadCards()} style={{ marginTop: "var(--space-md)" }}>
            <Layers size={15} strokeWidth={1.8} />
            Generate Flashcards
          </button>
        </div>
      )}
    </div>
  );
}
