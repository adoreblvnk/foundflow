import AppHeader from "@/components/AppHeader";

const sectionStyle = {
  fontSize: "0.92rem",
  lineHeight: 1.7,
  color: "var(--muted)",
};

export default function AboutPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <AppHeader />

      <div style={{
        width: "min(720px, calc(100% - 40px))",
        marginInline: "auto",
        paddingBlock: "48px 80px",
      }}>
        <section style={{ marginBottom: "48px" }}>
          <p className="eyebrow">About FoundFlow</p>
          <h1 style={{ fontSize: "2.2rem", lineHeight: 1.1, letterSpacing: "-0.04em", marginBottom: "20px" }}>
            Built by Team Adore for Launchpad 2026
          </h1>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "var(--muted)" }}>
            FoundFlow is an independent hackathon project exploring how guided photography and human-reviewed AI
            can make found-item intake faster, clearer, and easier to verify. It is a student-built prototype, not
            an official lost-and-found service.
          </p>
        </section>

        <section style={{ display: "grid", gap: "36px" }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>The challenge</h2>
            <p style={{ ...sectionStyle, margin: 0 }}>
              Complex found-item cases can contain bags, pouches, documents, electronics, mixed currencies, and
              other nested contents. Recording every item manually is slow, while a flat description can lose the
              relationship between each object, its container, and its source photo.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>Our project</h2>
            <p style={{ ...sectionStyle, margin: 0 }}>
              FoundFlow turns guided item photos into a structured, photo-linked draft. It preserves container
              hierarchy, proposes quantities and item details, and gives staff one review workspace to correct and
              confirm the record before completion.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>How the prototype works</h2>
            <div style={{ ...sectionStyle, display: "grid", gap: "12px" }}>
              <p style={{ margin: 0 }}>
                <strong>1. Record the case:</strong> Add the found location, date and time, outer item, and storage location.
              </p>
              <p style={{ margin: 0 }}>
                <strong>2. Photograph each level:</strong> Capture the outer item first, then open one container at a time.
              </p>
              <p style={{ margin: 0 }}>
                <strong>3. Generate a draft:</strong> AI proposes item records, quantities, nested relationships, currency details, and photo boxes.
              </p>
              <p style={{ margin: 0 }}>
                <strong>4. Review every item:</strong> Staff confirm or correct the draft before the case can be completed.
              </p>
              <p style={{ margin: 0 }}>
                <strong>5. Verify collection:</strong> Claims use independent ownership checks and an auditable handover record.
              </p>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>What we built</h2>
            <ul style={{ ...sectionStyle, paddingLeft: "20px", margin: 0, display: "grid", gap: "8px", listStyle: "disc" }}>
              <li>Guided, container-by-container photo intake</li>
              <li>Structured AI drafts with per-item photo boxes</li>
              <li>Nested bag, pouch, and contents relationships</li>
              <li>Exact currency denomination and quantity records</li>
              <li>One scan action with automatic AI provider fallback</li>
              <li>Staff review gates for money, documents, perishables, and uncertain details</li>
              <li>Search, ownership verification, collection, and activity history</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>Human control</h2>
            <ul style={{ ...sectionStyle, paddingLeft: "20px", margin: 0, display: "grid", gap: "8px", listStyle: "disc" }}>
              <li>AI output remains a draft until staff review it.</li>
              <li>Every completed item links to a source photo or an explicit staff addition.</li>
              <li>Sensitive and uncertain details require explicit confirmation.</li>
              <li>Private matching details remain outside search results.</li>
              <li>A failed scan does not block manual case completion.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>Team</h2>
            <p style={{ ...sectionStyle, margin: 0 }}>
              <strong>Team Adore</strong><br />
              Joseph &amp; Tze Kai<br />
              Launchpad 2026 AI Challenge
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>Hackathon scope</h2>
            <p style={{ ...sectionStyle, margin: 0 }}>
              This functional prototype demonstrates the complete path from guided intake to reviewed item records,
              search, ownership verification, and collection. A production deployment would require organisation-specific
              access controls, operating procedures, retention policies, and integration with existing systems.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
