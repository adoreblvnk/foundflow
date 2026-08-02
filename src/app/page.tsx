import Link from "next/link";
import AppHeader from "@/components/AppHeader";

const operations = [
  { href: "/cases/new", label: "+ New Case", primary: true },
  { href: "/cases", label: "Open Cases", primary: false },
  { href: "/search", label: "Search Items", primary: false },
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
          Found property
        </h1>

        <div style={{ display: "grid", gap: "12px" }}>
          {operations.map((operation) => (
            <Link
              key={operation.href}
              href={operation.href}
              className={operation.primary ? "button" : "button button-secondary"}
              style={{
                justifyContent: "space-between",
                minHeight: "56px",
                paddingInline: "18px",
                fontSize: "0.95rem",
              }}
            >
              <span>{operation.label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
