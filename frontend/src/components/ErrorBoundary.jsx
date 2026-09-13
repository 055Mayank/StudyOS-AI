import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "var(--space-2xl)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
          textAlign: "center",
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          margin: "var(--space-xl)",
          boxShadow: "var(--shadow-sm)"
        }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "#ffebee",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#c62828",
            marginBottom: "var(--space-md)"
          }}>
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "var(--space-sm)" }}>
            Something went wrong
          </h2>
          <p style={{ color: "var(--text-muted)", maxWidth: "480px", marginBottom: "var(--space-lg)", fontSize: "14px" }}>
            An unexpected error occurred while rendering this view. Your saved documents and deadlines remain safe.
          </p>
          {this.state.error && (
            <pre style={{
              background: "var(--surface-cream)",
              padding: "var(--space-md)",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              color: "var(--text)",
              maxWidth: "600px",
              overflowX: "auto",
              marginBottom: "var(--space-lg)",
              textAlign: "left"
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button className="btn btn-primary" onClick={this.handleReset}>
            <RefreshCw size={16} />
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
