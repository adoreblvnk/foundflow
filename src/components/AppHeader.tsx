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
      <svg className="brand-mark" viewBox="0 0 44 44" aria-hidden="true">
        <path d="M8 23.5c0-8.6 6.4-15.5 14.3-15.5 6.1 0 11.3 4 13.4 9.7" />
        <path d="M36 20.5C36 29.1 29.6 36 21.7 36 15.6 36 10.4 32 8.3 26.3" />
        <path d="M12 14.5c6.2 1.1 13.4 5.2 20 14.8" />
      </svg>
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
