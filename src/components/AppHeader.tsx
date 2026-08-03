"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <header style={{
      borderBottom: "1px solid var(--line)",
      background: "var(--panel)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        width: "min(1160px, calc(100% - 40px))",
        marginInline: "auto",
        minHeight: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <Link href="/" style={{ fontSize: "1.15rem", fontWeight: 760, letterSpacing: "-0.04em" }}>
          FoundFlow
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link
            href="/"
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: pathname === "/" ? "var(--green)" : "var(--muted)",
            }}
          >
            Home
          </Link>

          <Link
            href="/about"
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: pathname === "/about" ? "var(--green)" : "var(--muted)",
            }}
          >
            About Us
          </Link>

          <Link
            href="/guide"
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: pathname === "/guide" ? "var(--green)" : "var(--muted)",
            }}
          >
            Guide
          </Link>
        </nav>
      </div>
    </header>
  );
}
