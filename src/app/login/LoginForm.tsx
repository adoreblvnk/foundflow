"use client";

import { useState } from "react";
import { handleLogin } from "./actions";
import Link from "next/link";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    try {
      const result = await handleLogin(formData);
      if (result && result.error) {
        setError(result.error);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="demo-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header className="shell nav" style={{ borderBottom: "1px solid var(--line)", width: "100%", margin: 0, paddingInline: "40px" }}>
        <Link className="brand" href="/">FoundFlow</Link>
        <span className="muted" style={{ fontSize: "0.85rem" }}>Launchpad 2026</span>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          padding: "36px",
          boxShadow: "0 20px 40px rgba(22, 49, 37, 0.05)"
        }}>
          <p className="eyebrow" style={{ textAlign: "center", marginBottom: "8px" }}>Copilot Intake Portal</p>
          <h1 style={{ fontSize: "2rem", textAlign: "center", letterSpacing: "-0.04em", margin: "0 0 12px" }}>Sign In</h1>
          <p className="muted" style={{ textAlign: "center", fontSize: "0.88rem", marginBottom: "30px", lineHeight: 1.4 }}>
            Access protected property records and photo-linked item lists.
          </p>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: "20px" }}>
            <div style={{ display: "grid", gap: "6px" }}>
              <label htmlFor="username" style={{ fontWeight: 600, fontSize: "0.85rem" }}>Staff Identifier</label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="staff-name"
                required
                style={{
                  minHeight: "44px",
                  paddingInline: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--paper)",
                  fontSize: "0.95rem"
                }}
              />
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label htmlFor="password" style={{ fontWeight: 600, fontSize: "0.85rem" }}>Security Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                style={{
                  minHeight: "44px",
                  paddingInline: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--paper)",
                  fontSize: "0.95rem"
                }}
              />
              <small className="muted" style={{ fontSize: "0.75rem", marginTop: "2px" }}>
                Use credentials from your local environment configuration.
              </small>
            </div>

            {error && (
              <div style={{
                background: "#fdf2f2",
                border: "1px solid #fbd5d5",
                borderRadius: "8px",
                padding: "12px",
                color: "#c81e1e",
                fontSize: "0.85rem",
                fontWeight: 600,
                textAlign: "center"
              }}>
                {error}
              </div>
            )}

            <button className="button full-width" type="submit" disabled={loading} style={{ minHeight: "46px" }}>
              {loading ? "Verifying..." : "Sign in to FoundFlow"}
            </button>
          </form>
        </div>
      </div>

      <footer className="shell footer" style={{ width: "100%", borderTop: "1px solid var(--line)", paddingInline: "40px" }}>
        <span>Secure Prototype Authentication</span>
        <span>AI drafts. Staff decide.</span>
      </footer>
    </main>
  );
}
