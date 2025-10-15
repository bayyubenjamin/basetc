// app/components/ClientErrorHUD.tsx
"use client";
import { useEffect, useState } from "react";

type E = { message: string; stack?: string };

export default function ClientErrorHUD() {
  const [err, setErr] = useState<E | null>(null);

  useEffect(() => {
    const onErr = (event: ErrorEvent) => {
      setErr({ message: event.message || "Error", stack: event.error?.stack });
    };
    const onRej = (event: PromiseRejectionEvent) => {
      const msg =
        (event.reason && (event.reason.message || String(event.reason))) ||
        "Unhandled rejection";
      setErr({ message: msg, stack: event.reason?.stack });
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  if (!err) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        zIndex: 10001,
        maxWidth: 320,
        fontSize: 12,
        background: "#180c0c",
        color: "#ffd1d1",
        border: "1px solid #ff6b6b",
        borderRadius: 8,
        padding: "8px 10px",
        boxShadow: "0 0 0 1px rgba(0,0,0,.2)",
        opacity: 0.95,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>client error</div>
      <div>{err.message}</div>
      {err.stack ? <div style={{ marginTop: 6, opacity: 0.8 }}>{err.stack.split("\n").slice(0, 3).join("\n")}</div> : null}
    </div>
  );
}

