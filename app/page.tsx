"use client";

import { useEffect, useState } from "react";

/* ===============================
   TYPES
================================ */
type MsgRole = "user" | "assistant";
type Msg = { role: MsgRole; text: string };

/* ===============================
   CONFIG
================================ */
const MAX_USER_MESSAGES = 8;
const LOCK_HOURS = 24;
const LOCK_MS = LOCK_HOURS * 60 * 60 * 1000;

/* ===============================
   STORAGE HELPERS
================================ */
function getLockUntil(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem("bt_lock_until");
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function setLockUntil(ts: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem("bt_lock_until", String(ts));
}

function formatLockTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

/* ===============================
   PAGE
================================ */
export default function Page() {
  const [inviteCode, setInviteCode] = useState("");
  const [input, setInput] = useState("");
  const [log, setLog] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const [lockUntil, setLockUntilState] = useState<number>(0);

  useEffect(() => {
    setLockUntilState(getLockUntil());
  }, []);

  const isLocked: boolean = lockUntil > Date.now();
  const userMessageCount: number = log.filter((m) => m.role === "user").length;

  /* ===============================
     SESSION CONTROL
  ================================ */
  function resetSession() {
    if (isLocked) return;
    setLog([]);
    setInput("");
  }

  /* ===============================
     SEND MESSAGE
  ================================ */
  async function send() {
    if (!input.trim() || sending) return;
    if (isLocked) return;

    // Stop sending if they already hit the limit
    if (userMessageCount >= MAX_USER_MESSAGES) return;

    const userText = input.trim();
    setInput("");
    setSending(true);

    // IMPORTANT: type this so role stays "user" not string
    const newLog: Msg[] = [...log, { role: "user", text: userText }];
    setLog(newLog);

    const isFinalMessage = userMessageCount + 1 >= MAX_USER_MESSAGES;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "expression",
          inviteCode,
          userText,
          messageCount: userMessageCount + 1,
          closing: isFinalMessage,
        }),
      });

      const data = await res.json();
      let assistantText: string = data.output ?? "No response.";

      if (isFinalMessage) {
        assistantText =
          assistantText +
          "\n\nWe’ll leave it there. You can start another session if and when you choose.";

        const until = Date.now() + LOCK_MS;
        setLockUntil(until);
        setLockUntilState(until);
      }

      setLog((l) => [...l, { role: "assistant", text: assistantText }]);
    } catch {
      setLog((l) => [...l, { role: "assistant", text: "Network error." }]);
    } finally {
      setSending(false);
    }
  }

  /* ===============================
     UI
  ================================ */
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto", color: "white" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
        Boundary Tools — Beta
      </h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            color: "white",
            flex: 1,
            minWidth: 220,
          }}
          placeholder="Invite code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />

        <button
          onClick={resetSession}
          disabled={isLocked}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            background: isLocked ? "#222" : "transparent",
            color: "white",
            cursor: isLocked ? "not-allowed" : "pointer",
          }}
        >
          New session
        </button>
      </div>

      {isLocked && (
        <div
          style={{
            border: "1px solid #444",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            opacity: 0.85,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700 }}>Session locked</div>
          <div>New session available after: {formatLockTime(lockUntil)}</div>
        </div>
      )}

      <div
        style={{
          border: "1px solid #333",
          borderRadius: 12,
          padding: 16,
          minHeight: 320,
          marginBottom: 14,
        }}
      >
        {log.length === 0 ? (
          <div style={{ opacity: 0.75 }}>
            <div style={{ fontWeight: 700 }}>Boundary Tool: Expression</div>
            <p>
              This is a deliberately limited reflection tool.
              <br />
              It does not give advice, reassurance, or direction.
              <br />
              You may write freely. Responses will be brief and neutral.
            </p>
            <p style={{ marginTop: 8, fontSize: 14 }}>
              Messages this session: 0 / {MAX_USER_MESSAGES}
            </p>
          </div>
        ) : (
          <>
            {log.map((m, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>{m.role}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
            <div style={{ fontSize: 14, opacity: 0.75 }}>
              Messages this session: {userMessageCount} / {MAX_USER_MESSAGES}
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <textarea
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            color: "white",
            flex: 1,
          }}
          rows={3}
          placeholder={isLocked ? "Session locked." : "Write here…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending || isLocked || userMessageCount >= MAX_USER_MESSAGES}
        />
        <button
          onClick={send}
          disabled={sending || isLocked || userMessageCount >= MAX_USER_MESSAGES}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "white",
            color: "black",
            cursor: sending || isLocked ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </main>
  );
}
