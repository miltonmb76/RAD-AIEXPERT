import React from "react";

type Props = {
  children: React.ReactNode;
  /** Optional label for nested module boundaries */
  label?: string;
};

type State = {
  error: Error | null;
  componentStack: string;
  resetKey: number;
};

/**
 * Catches render crashes that otherwise leave only the dark-blue #root shell
 * (the "pantalla azul" that forces a full restart).
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: "", resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`,
      error,
      info?.componentStack
    );
    this.setState({ componentStack: String(info?.componentStack || "") });
    try {
      sessionStorage.setItem(
        "rad_last_ui_crash",
        JSON.stringify({
          at: new Date().toISOString(),
          message: String(error?.message || error),
          label: this.props.label || "app",
        })
      );
    } catch {
      /* ignore quota */
    }
  }

  private handleSoftRecover = () => {
    this.setState((s) => ({
      error: null,
      componentStack: "",
      resetKey: s.resetKey + 1,
    }));
  };

  private handleHardReload = () => {
    try {
      sessionStorage.setItem("rad_ui_crash_reload", "1");
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const isModule = Boolean(this.props.label);
      const msg = String(this.state.error.message || this.state.error);
      return (
        <div
          role="alert"
          style={{
            minHeight: isModule ? undefined : "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            boxSizing: "border-box",
            background: isModule ? "rgba(15,23,42,0.95)" : "#0f172a",
            color: "#e2e8f0",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            textAlign: "center",
            borderRadius: isModule ? 16 : 0,
            border: isModule ? "1px solid rgba(248,113,113,0.35)" : "none",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#fecaca",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {isModule
              ? `Fallo en ${this.props.label}`
              : "La interfaz se detuvo"}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#94a3b8",
              maxWidth: "28rem",
              lineHeight: 1.45,
            }}
          >
            {isModule
              ? "Este módulo falló. Puedes reintentarlo sin cerrar el resto de la sesión."
              : "Pantalla azul / vacía por un error de React. No hace falta reiniciar el servidor: recupera aquí."}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              maxWidth: "32rem",
              wordBreak: "break-word",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {msg.slice(0, 280)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={this.handleSoftRecover}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid #34d399",
                background: "#064e3b",
                color: "#d1fae5",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reintentar sin recargar
            </button>
            {!isModule && (
              <button
                type="button"
                onClick={this.handleHardReload}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid #6366f1",
                  background: "#312e81",
                  color: "#e0e7ff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Recargar página
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
    );
  }
}

export default AppErrorBoundary;
