import AppHeader from "@/components/AppHeader";

export default function AboutPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <AppHeader />

      <div style={{
        width: "min(720px, calc(100% - 40px))",
        marginInline: "auto",
        paddingBlock: "48px 80px",
      }}>
        {/* Hero */}
        <section style={{ marginBottom: "48px" }}>
          <p className="eyebrow">About Us</p>
          <h1 style={{ fontSize: "2.2rem", lineHeight: 1.1, letterSpacing: "-0.04em", marginBottom: "20px" }}>
            Changi Airport Lost &amp; Found
          </h1>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "var(--muted)" }}>
            FoundFlow is the staff-facing intake system for Changi Airport&apos;s Lost &amp; Found service.
            We help reunite passengers with their belongings through fast, accurate documentation and
            a structured matching process between found items and lost reports.
          </p>
        </section>

        <section style={{ display: "grid", gap: "36px" }}>
          {/* Our Mission */}
          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>Our Mission</h2>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--muted)", margin: 0 }}>
              Every year, thousands of items are left behind at Changi Airport — in transit areas,
              gate hold rooms, lounges, and public spaces. Our goal is to document every found item
              quickly and accurately, so that when a passenger files a lost report, we can match it
              to what we have on record and return it as soon as possible.
            </p>
          </div>

          {/* How It Works */}
          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>How It Works</h2>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--muted)", display: "grid", gap: "12px" }}>
              <p style={{ margin: 0 }}>
                <strong>1. Item found</strong> — When an item is discovered by staff, cleaners, or handed in by
                a passenger, our team logs the terminal, area, and time of discovery.
              </p>
              <p style={{ margin: 0 }}>
                <strong>2. Photo documentation</strong> — Staff photograph the item and its contents layer by layer.
                Our AI system reads the photos and drafts a structured inventory including brands,
                colours, currency denominations, and document details.
              </p>
              <p style={{ margin: 0 }}>
                <strong>3. Staff verification</strong> — Every AI-detected detail is reviewed and confirmed by
                trained staff. No record is finalised without human sign-off.
              </p>
              <p style={{ margin: 0 }}>
                <strong>4. Secure storage</strong> — Items are stored in our designated Lost &amp; Found facility
                with tracked custody records.
              </p>
              <p style={{ margin: 0 }}>
                <strong>5. Matching &amp; collection</strong> — When a passenger files a lost report, our system
                compares their description against found items. Ownership is verified through independent
                evidence before handover.
              </p>
            </div>
          </div>

          {/* Coverage */}
          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>Where We Operate</h2>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--muted)", display: "grid", gap: "8px" }}>
              <p style={{ margin: 0 }}>
                Our service covers all areas managed by Changi Airport Group:
              </p>
              <ul style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "4px" }}>
                <li>Terminal 1, 2, 3, and 4 — Public and transit areas</li>
                <li>Gate hold rooms</li>
                <li>Jewel Changi Airport</li>
                <li>Transport areas (taxi stands, bus stops, car parks)</li>
              </ul>
              <p style={{ margin: 0, marginTop: "8px" }}>
                <strong>Note:</strong> Items left onboard aircraft are managed by the airline&apos;s handling agent
                (dnata or SATS). Please contact them directly for inflight lost property.
              </p>
            </div>
          </div>

          {/* Privacy & Security */}
          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>Privacy &amp; Security</h2>
            <ul style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--muted)", paddingLeft: "20px", margin: 0, display: "grid", gap: "8px", listStyle: "disc" }}>
              <li>Item photos are stored in private, access-controlled storage — never publicly accessible.</li>
              <li>Personal documents (passports, IDs, cards) are recorded with minimal identifiers only. Full numbers are never stored unless airport policy requires it.</li>
              <li>Private matching details (hidden compartment contents, exact denominations, distinctive markings) are withheld from public view and used only during ownership verification.</li>
              <li>All actions are logged in an audit trail with staff identity and timestamp.</li>
              <li>Collection requires verified proof of ownership before any item is released.</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>Contact Us</h2>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--muted)", display: "grid", gap: "8px" }}>
              <p style={{ margin: 0 }}>
                For lost items within the airport premises, file a report through our system or visit
                the Lost &amp; Found counter at any terminal.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Operating hours:</strong> 24 hours, 7 days a week
              </p>
              <p style={{ margin: 0 }}>
                <strong>General enquiries:</strong> +65 6595 6868
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
