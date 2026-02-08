"use client";

import { useState } from "react";

export default function BoundaryCheckPage() {
  const [situation, setSituation] = useState("");
  const [q1, setQ1] = useState<"yes" | "no" | null>(null);
  const [q2, setQ2] = useState<"yes" | "no" | null>(null);

  let recommendation = "Answer the questions to get a recommendation.";
  let boundarySentence = "Answer both questions to generate a boundary sentence.";

  if (q1 === "yes" && q2 === "no") {
    recommendation = "This looks like a boundary situation.";
    boundarySentence = "I can’t take this on right now.";
  } else if (q1 === "no" && q2 === "yes") {
    recommendation = "This does not clearly require a boundary.";
    boundarySentence = "I’m okay to do this.";
  } else if (q1 && q2) {
    recommendation = "This situation needs more reflection.";
    boundarySentence = "I need to think about this before responding.";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#0b0b0b",
        color: "white",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <a href="/" style={{ color: "white", opacity: 0.75, textDecoration: "none" }}>
          ← Back
        </a>

        <h1 style={{ fontSize: 30, marginTop: 14 }}>Boundary Check</h1>

        <div style={{ marginTop: 18, maxWidth: 720 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            What are you being asked to do? (optional)
          </label>
          <input
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder='e.g., "cover your shift on Friday"'
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              color: "white",
            }}
          />
        </div>

        <p style={{ marginTop: 24 }}>
          <strong>Question 1:</strong> If you say “yes”, will you resent it later?
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <button onClick={() => setQ1("yes")}>Yes</button>
          <button onClick={() => setQ1("no")}>No</button>
          <button
            onClick={() => {
              setQ1(null);
              setQ2(null);
            }}
          >
            Reset
          </button>
        </div>

        {q1 && (
          <>
            <p style={{ marginTop: 24 }}>
              <strong>Question 2:</strong> Do you realistically have the time and energy for this right now?
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              <button onClick={() => setQ2("yes")}>Yes</button>
              <button onClick={() => setQ2("no")}>No</button>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <p>
            <strong>Recommendation:</strong> {recommendation}
          </p>
          <p>
            <strong>Suggested boundary sentence:</strong> {boundarySentence}
          </p>
        </div>
      </div>
    </main>
  );
}
