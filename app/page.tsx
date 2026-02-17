import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "56px 24px",
        background: "#0b0b0b",
        color: "white",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 46, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>
          Boundary Tools — Beta
        </h1>

        <p style={{ marginTop: 12, opacity: 0.82, maxWidth: 820, lineHeight: 1.6 }}>
          Invite-only, deliberately limited tools. No advice. No “next steps”. No memory.
          Designed to reduce avoidable mistakes by keeping the space narrow and contained.
        </p>

        <div
          style={{
            marginTop: 22,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 16,
            padding: 18,
            maxWidth: 820,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10 }}>What to expect</div>
          <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.85, lineHeight: 1.7 }}>
            <li>Short replies.</li>
            <li>Sessions end on purpose.</li>
            <li>Invite-only access.</li>
          </ul>
        </div>

        <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/tools/expression"
            style={{
              display: "inline-block",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.22)",
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Open Expression
          </Link>

          <Link
            href="/tools/decision"
            style={{
              display: "inline-block",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.22)",
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Open Decision Boundary
          </Link>
        </div>

        <p style={{ marginTop: 14, opacity: 0.75 }}>
          If you were given an invite code, you’ll enter it inside the tool.
        </p>
      </div>
    </main>
  );
}
