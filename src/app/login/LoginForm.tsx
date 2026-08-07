"use client";

import { useState } from "react";
import Link from "next/link";
import { FoundFlowBrand } from "@/components/AppHeader";
import { handleLogin } from "./actions";

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
      if (result?.error) setError(result.error);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="portal-page">
      <a className="skip-link" href="#main-content">Skip to Main Content</a>
      <div id="main-content" className="portal-home">
        <section className="portal-intro" aria-labelledby="login-intro-title">
          <Link href="/" aria-label="FoundFlow home"><FoundFlowBrand /></Link>
          <h1 id="login-intro-title" className="portal-title">Staff Access Portal</h1>
          <p className="portal-copy">
            Sign in to manage protected found-item records, photo-linked inventory and verified claimant handovers.
          </p>
          <p className="portal-version">Independent Launchpad 2026 prototype · Team Adore</p>
        </section>

        <section className="portal-panel" aria-labelledby="login-title">
          <div className="portal-panel-heading">
            <h2 id="login-title">Staff Sign In</h2>
            <p>Use your authorized FoundFlow credentials.</p>
          </div>
          <form onSubmit={onSubmit} className="portal-form">
            <label htmlFor="username">
              Staff Identifier
              <input id="username" name="username" type="text" placeholder="Enter staff identifier…" autoComplete="username" spellCheck={false} required />
            </label>
            <label htmlFor="password">
              Security Password
              <input id="password" name="password" type="password" placeholder="Enter password…" autoComplete="current-password" required />
            </label>
            {error && <div className="form-message error" role="alert">{error}</div>}
            <button className="button full-width" type="submit" disabled={loading}>
              {loading ? "Signing In…" : "Sign In to FoundFlow"}
            </button>
          </form>
        </section>
      </div>
      <footer className="portal-footer">
        <span>Protected prototype authentication</span>
        <span>AI drafts. Staff decide.</span>
      </footer>
    </main>
  );
}
