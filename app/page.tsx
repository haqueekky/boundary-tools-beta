"use client";

import { useEffect, useMemo, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

const MAX_USER_MESSAGES = 8;

function formatLocalTime(ms: number) {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export default function Page() {
  const [inviteCode, setInviteCode] = useState("");
  const [input, setInput] = useState("");
  const [log, setLog] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);

  // UI lock (mirrors server lock). Server is still authoritative.
  const [lockUntil, setLockUntil] = useState<number>(0);

  useEffect(() => {
    const stored = Number(localStorage.getItem("bt_lock_until") || 0);
    if (stored) setLockUntil(stored);
  }, []);

  const now = Date.now();
  const isLocked = lockUntil && now < lockUntil;

  const userMessageCount = useMemo(
    () => log.filter((m) => m.role === "user").length,
    [log]
  );

  const sessionEndedByCount = userMessageCount >= MAX_USER_MESSAGES;

  async function send() {
    if (!input.trim() || sending || isLocked || sessionEndedByCount) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    setLog((l) => [...l, { role: "user", text }]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteCode,
        userText: text,
        userMessageCount: userMessageCount + 1, // includes current message
      }),
    });

    const data = await res.json();

    // If API returns lockUntil, store it for UI persistence
    if (data?.lockUntil) {
      setLockUntil(Number(data.lockUntil));
      localStorage.setItem("bt_lock_until", String(data.lockUntil));
    }

    setLog((l) => [
      ...l,
      { role: "assistant", text: data.output || `Error: ${data.error || res.status}` },
    ]);

    setSending(false);
  }

  function resetSession() {
    if (isLocked) return; // UI prevention; server also prevents actual usage
    setLog([]);
    setInput("");
  }

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", color: "white" }}>
      <h1 style={{ marginBottom: 12 }}>Boundary Tools — Expression</h1>

      <input
        placeholder="Invite code"
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 14 }}
      />

      {isLocked && (
        <div
          style={{
            border: "1px solid #555",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            opacity: 0.9,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700 }}>Session locked</div>
          <div>
            You can start a new session after:{" "}
            <span style={{ fontWeight: 700 }}>{formatLocalTime(lockUntil)}</span>
          </div>
        </div>
      )}

      <div
        style={{
          border: "1px solid #444",
          borderRadius: 12,
          padding: 14,
          minHeight: 260,
          marginBottom: 12,
        }}
      >
        {log.length === 0 ? (
          <div style={{ opacity: 0.85, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700 }}>Boundary Tool: Expression</div>

            <p>This is a limited reflection space.</p>
            <p>It does not give advice, reassurance, or direction.</p>

            <p>
              You can write whatever is on your mind, in your own words. The tool
              will reflect one central tension and then stop.
            </p>

            <p>When you’re ready, begin.</p>

            <div style={{ marginTop: 12, fontSize: 14, opacity: 0.7 }}>
              User messages: {userMessageCount}/{MAX_USER_MESSAGES}
            </div>
          </div>
        ) : (
          <>
            {log.map((m, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{m.role}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
            <div style={{ fontSize: 14, opacity: 0.7 }}>
              User messages: {userMessageCount}/{MAX_USER_MESSAGES}
            </div>
          </>
        )}
      </div>

      <textarea
        rows={3}
        placeholder={
          isLocked
            ? "Locked for 24 hours."
            : sessionEndedByCount
            ? "Session ended."
            : "Type…"
        }
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isLocked || sessionEndedByCount}
        style={{ width: "100%", padding: 10, borderRadius: 10 }}
      />

      <div style={{ marginTop: 10 }}>
        <button
          onClick={send}
          disabled={sending || isLocked || sessionEndedByCount}
          style={{ padding: "10px 14px", borderRadius: 10 }}
        >
          {isLocked
            ? "Locked"
            : sessionEndedByCount
            ? "Session ended"
            : sending
            ? "Sending…"
            : "Send"}
        </button>

        <button
          onClick={resetSession}
          disabled={isLocked}
          style={{
            marginLeft: 10,
            padding: "10px 14px",
            borderRadius: 10,
            opacity: isLocked ? 0.5 : 1,
          }}
        >
          New session
        </button>
      </div>
    </main>
  );
}
