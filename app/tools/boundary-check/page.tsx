"use client";

import { useState } from "react";

type Answer = "yes" | "no" | null;

export default function BoundaryCheckPage() {
  const [q1, setQ1] = useState<Answer>(null);
  const [q2, setQ2] = useState<Answer>(null);
  const [situation, setSituation] = useState("");

  // Recommendation
  let recommendation = "Answer the questions to get a recommendation.";

  if (q1 && q2) {
    if (q1 === "yes" && q2 === "no") {
      recommendation =
        "Strong no. You’ll resent it AND you don’t have the capacity right now.";
    } else if (q1 === "yes" || q2 === "no") {
      recommendation =
        "Proceed with caution. If you agree, set a clear limit or offer an alternative.";
    } else {
      recommendation = "Green light. This looks aligned — say yes without guilt.";
    }
  }

  // Boundary sentence
  const situationText = situation.trim() || "that";

  let boundarySentence = "Answer both questions to generate a boundary sentence.";

  if (q1 && q2) {
    if (q1 === "yes" && q2 === "no") {
      boundarySentence = `Thanks for asking — I can’t commit to ${situationText} right now. I don’t have the bandwidth, so I’ll need to pass.`;
    } else if (q1 === "yes" && q2 === "yes") {
      boundarySentence = `I can do ${situationText}, but I need to set a boundary: I can only do a smaller version, and I’ll stop if it starts to feel too much.`;
    } else if (q1 === "no" && q2 === "no") {
      boundarySentence = `I can’t take on ${situationText} right now — my time and energy are already fully booked.`;
    } else {
      boundarySentence = `Yes, I can do ${situationText}. Just to be clear, I can do it within a limit that works for me.`;
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 40,
        background: "#0b0b0b",
        color: "white",
      }}
    >
      <a
        href="/"
        style={{ color: "white", opacity: 0.75, textDecoration: "none" }}
      >
        ← Back
      </a>

      <h1 style={{ fontSize: 34, marginTop: 14 }}>Boundary Check</h1>

      <div style={{ marginTop: 18, maxWidth: 780, lineHeight: 1.5 }}>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: "block", opacity: 0.85, marginBottom: 8 }}>
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
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "white",
              outline: "none",
            }}
          />
        </div>

        <p style={{ marginTop: 18 }}>
          Question 1:{" "}
          <strong>If you say “yes”, will you resent it later?</strong>
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <button
            onClick={() => {
              setQ1("yes");
              setQ2(null);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: q1 === "yes" ? "white" : "transparent",
              color: q1 === "yes" ? "black" : "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Yes (I’ll resent it)
          </button>

          <button
            onClick={() => {
              setQ1("no");
              setQ2(null);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: q1 === "no" ? "white" : "transparent",
              color: q1 === "no" ? "black" : "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            No (I won’t resent it)
          </button>

          <button
            onClick={() => {
              setQ1(null);
              setQ2(null);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "white",
              cursor: "pointer",
              opacity: 0.8,
            }}
          >
            Reset
          </button>
        </div>

        {q1 && (
          <>
            <p style={{ marginTop: 24 }}>
              Question 2:{" "}
              <strong>
                Do you realistically have the time and energy for this right now?
              </strong>
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 12,
              }}
            >
              <button
                onClick={() => setQ2("yes")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: q2 === "yes" ? "white" : "transparent",
                  color: q2 === "yes" ? "black" : "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Yes
              </button>

              <button
                onClick={() => setQ2("no")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: q2 === "no" ? "white" : "transparent",
                  color: q2 === "no" ? "black" : "white",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                No
              </button>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Recommendation:</strong> {recommendation}
          </p>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Suggested boundary sentence:</strong> {boundarySentence}
          </p>

          {q1 && q2 && (
            <button
              onClick={() => navigator.clipboard.writeText(boundarySentence)}
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "white",
                color: "black",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Copy sentence
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
