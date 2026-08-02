"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppHeader() {
  const pathname = usePathname();
  const isKiosk = pathname.startsWith("/kiosk");

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
            href="/about"
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: pathname === "/about" ? "var(--green)" : "var(--muted)",
            }}
          >
            About
          </Link>

          <Link
            href="/search"
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: pathname === "/search" ? "var(--green)" : "var(--muted)",
            }}
          >
            🔍 Search
          </Link>

          {/* Mode Toggle */}
          <div style={{
            display: "flex",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            overflow: "hidden",
            fontSize: "0.78rem",
            fontWeight: 700,
          }}>
            <Link
              href="/kiosk"
              style={{
                padding: "6px 14px",
                background: isKiosk ? "var(--green)" : "transparent",
                color: isKiosk ? "white" : "var(--muted)",
                transition: "background 0.15s",
              }}
            >
              Kiosk
            </Link>
            <Link
              href="/cases"
              style={{
                padding: "6px 14px",
                background: !isKiosk ? "var(--green)" : "transparent",
                color: !isKiosk ? "white" : "var(--muted)",
                transition: "background 0.15s",
              }}
            >
              Mobile
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
