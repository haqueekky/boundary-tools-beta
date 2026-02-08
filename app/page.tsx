export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 28,
        background: "#0b0b0b",
        color: "white",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34, margin: 0 }}>Boundary Tools — Beta</h1>
        <p style={{ opacity: 0.85, marginTop: 10, lineHeight: 1.6 }}>
          Invite-only, deliberately limited tools. No advice. No “next steps”. No memory.
          Designed to reduce avoidable mistakes by keeping the space narrow and contained.
        </p>

        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.04)",
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>What to expect</div>
          <ul style={{ marginTop: 8, paddingLeft: 18, opacity: 0.9 }}>
            <li>Short replies (1–3 sentences).</li>
            <li>Sessions end on purpose.</li>
            <li>Invite-only access.</li>
          </ul>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href="/tools/expression"
            style={{
              display: "inline-block",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.22)",
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Open Expression
          </a>

          <a
            href="/tools/boundary-check"
            style={{
              display: "inline-block",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.22)",
              color: "white",
              textDecoration: "none",
              fontWeight: 700,
              opacity: 0.9,
            }}
          >
            Open Boundary Check
          </a>
        </div>

        <p style={{ marginTop: 18, opacity: 0.75, lineHeight: 1.6 }}>
          If you were given an invite code, you’ll enter it inside the tool.
        </p>
      </div>
    </main>
  );
}
