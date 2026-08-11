"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/cases", label: "Cases" },
  { href: "/search", label: "Search" },
  { href: "/guide", label: "Guide" },
  { href: "/about", label: "About" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FoundFlowBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`}>
      <span>
        <strong>FoundFlow</strong>
        {!compact && <small>Lost &amp; Found Operations</small>}
      </span>
    </span>
  );
}

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="app-header">
      <a className="skip-link" href="#main-content">Skip to Main Content</a>
      <div className="app-header-inner shell">
        <Link href="/" className="brand-link" aria-label="FoundFlow home">
          <FoundFlowBrand />
        </Link>
        <nav className="app-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link className="button app-header-action" href="/cases/new">New Case</Link>
      </div>
    </header>
  );
}
