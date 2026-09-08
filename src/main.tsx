import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const BootFallback = () => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      background: "#0f172a",
      color: "#94a3b8",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: 13,
    }}
  >
    Cargando módulos…
  </div>
);

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("No se encontró #root");
}

try {
  createRoot(rootEl).render(
    <StrictMode>
      <Suspense fallback={<BootFallback />}>
        <App />
      </Suspense>
    </StrictMode>
  );
} catch (err) {
  console.error("Fallo al montar la app:", err);
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;background:#0f172a;color:#e2e8f0;font-family:ui-sans-serif,system-ui,sans-serif;text-align:center;">
      <div style="font-size:15px;font-weight:700;color:#c7d2fe;">No se pudo cargar RAD AI Expert</div>
      <div style="font-size:13px;color:#94a3b8;max-width:28rem;line-height:1.45;">
        Error al iniciar. Tras un reinicio del servidor suele bastar con reintentar.
      </div>
      <button type="button" onclick="window.location.reload()"
        style="margin-top:8px;padding:10px 16px;border-radius:10px;border:1px solid #6366f1;background:#312e81;color:#e0e7ff;font-size:13px;font-weight:600;cursor:pointer;">
        Reintentar
      </button>
    </div>
  `;
}
