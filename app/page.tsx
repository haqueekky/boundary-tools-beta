import Link from "next/link";

export default function HomePage() {
  const cardStyle: React.CSSProperties = {
    border: "1px solid #333",
    borderRadius: 14,
    padding: 16,
    background: "transparent",
    color: "white",
    textDecoration: "none",
    display: "block",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
    marginTop: 16,
  };

  const smallStyle: React.CSSProperties = {
    opacity: 0.8,
    lineHeight: 1.5,
    fontSize: 14,
  };

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto", color: "white" }}>
      <div style={{ marginBottom: 10, opacity: 0.85 }}>
        <div style={{ fontSize: 14, letterSpacing: 0.2 }}>
          A short, deliberate pause before you commit.
        </div>
      </div>

      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
        Boundary Tools
      </div>

      <div style={{ ...smallStyle, maxWidth: 820 }}>
        Deliberately constrained tools. No advice. No reassurance. No memory. Each tool does
        one narrow thing.
      </div>

      <div style={gridStyle}>
        <Link href="/tools/expression" style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Expression Boundary</div>
          <div style={smallStyle}>
            Sharpens what’s unclear or conflicted without steering you.
          </div>
        </Link>

        <Link href="/tools/decision" style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Decision Boundary</div>
          <div style={smallStyle}>
            Surfaces one constraint, trade-off, or assumption in the decision frame.
          </div>
        </Link>

        <Link href="/tools/quietreflection" style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Quiet Reflection</div>
          <div style={smallStyle}>
            Lowers heat and reduces escalation in workplace situations—without advice.
          </div>
        </Link>

        <Link href="/tools/assumption" style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Assumption Boundary</div>
          <div style={smallStyle}>
            Paste text (≤800 words). Separates facts, assumptions/inferences, and ambiguities.
          </div>
        </Link>
      </div>

      <div style={{ marginTop: 18, ...smallStyle, maxWidth: 820 }}>
        If you want answers, guidance, or a conversation, these tools will feel “too small.”
        That constraint is the point.
      </div>
    </main>
  );
}