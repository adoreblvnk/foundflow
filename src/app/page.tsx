import Link from "next/link";
import AppHeader from "@/components/AppHeader";

const operations = [
  { href: "/cases/new", label: "Log Found Item", description: "Document a new item found on premises" },
  { href: "/cases", label: "Manage Cases", description: "View, review and complete active cases" },
  { href: "/search", label: "Search Records", description: "Look up items across all cases" },
];

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <AppHeader />

      <section style={{
        width: "min(720px, calc(100% - 40px))",
        marginInline: "auto",
        paddingBlock: "56px",
      }}>
        <h1 style={{ fontSize: "2.25rem", letterSpacing: "-0.04em", margin: "0 0 28px" }}>
          Lost and Found
        </h1>

        <div style={{ display: "grid", gap: "12px" }}>
          {operations.map((operation) => (
            <Link
              key={operation.href}
              href={operation.href}
              className="button"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                minHeight: "64px",
                paddingInline: "18px",
                paddingBlock: "12px",
                fontSize: "0.95rem",
                background: "#680be1",
                borderColor: "#680be1",
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 700 }}>{operation.label}</span>
                <span style={{ fontSize: "0.78rem", opacity: 0.8, fontWeight: 400 }}>{operation.description}</span>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
