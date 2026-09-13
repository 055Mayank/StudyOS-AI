import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

const ICONS = {
  success: <CheckCircle size={16} style={{ color: "var(--success)" }} />,
  error:   <AlertCircle size={16} style={{ color: "var(--error)" }} />,
  info:    <Info size={16} style={{ color: "var(--info)" }} />,
};

export default function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container" aria-live="polite" aria-label="Notifications">
      {toasts.map(({ id, message, type }) => (
        <div key={id} className="toast" role="status">
          {ICONS[type] || ICONS.info}
          <span style={{ flex: 1 }}>{message}</span>
          <button
            onClick={() => onDismiss(id)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: "2px" }}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
