"use client";

import { useMemo, useState } from "react";

type LogItem = { role: "user" | "assistant"; text: string };

const MAX_USER_MESSAGES = 8;

export default function ExpressionPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [sessionStartMs, setSessionStartMs] = useState<number>(() => Date.now());
  const [log, setLog] = useState<LogItem[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const userSentCount = useMemo(
    () => log.filter((m) => m.role === "user").length,
    [log]
  );

  const canSend = inviteCode.trim().length > 0 && !sending && !locked;

  async function send() {
    if (!canSend) return;

    const text = input.trim();
    if (!text) return;

    setAuthError(null);

    const userMessageCountBeforeSend = userSentCount;

    setInput("");
    setLog((prev) => [...prev, { role: "user", text }]);
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "expression",
          inviteCode: inviteCode.trim(),
          userText: text,
          userMessageCount: userMessageCountBeforeSend,
          sessionStartMs,
        }),
      });

      const data = await res.json();

      if (res.status === 401) {
        setAuthError("Invalid invite code.");
        setSending(false);
        setLog((prev) => prev.slice(0, -1));
        return;
      }

      const reply = (data?.output ?? "").toString();
      setLog((prev) => [...prev, { role: "assistant", text: reply }]);
      if (data?.locked) setLocked(true);
    } catch {
      setLog((prev) => [...prev, { role: "assistant", text: "Error: Network error" }]);
    } finally {
      setSending(false);
    }
  }

  function newSession() {
    setLog([]);
    setInput("");
    setLocked(false);
    setAuthError(null);
    setSessionStartMs(Date.now());
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto", color: "white" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>
        Expression Boundary
      </h1>

      <div style={{ opacity: 0.75, marginBottom: 14, fontSize: 14, lineHeight: 1.5 }}>
        A tightly bounded reflection tool.
        <br />
        It does not offer advice, reassurance, solutions, or validation.
        <br />
        It compresses what you wrote into one cleaner dynamic.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Invite code"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            color: "white",
            minWidth: 220,
          }}
        />

        <button
          onClick={newSession}
          disabled={sending}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            color: "white",
            cursor: "pointer",
          }}
        >
          New session
        </button>

        <div style={{ opacity: 0.7, fontSize: 14, alignSelf: "center" }}>
          Messages: {userSentCount}/{MAX_USER_MESSAGES}
        </div>
      </div>

      {authError && (
        <div style={{ marginBottom: 12, color: "#ffb3b3", fontSize: 14 }}>
          {authError}
        </div>
      )}

      <div
        style={{
          border: "1px solid #333",
          borderRadius: 12,
          padding: 16,
          minHeight: 320,
          marginBottom: 12,
        }}
      >
        {log.length === 0 ? (
          <div style={{ opacity: 0.75 }}>Write what feels unclear.</div>
        ) : (
          log.map((m, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>{m.role}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={locked ? "Session ended." : "Type…"}
          rows={3}
          disabled={!canSend}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            color: "white",
            flex: 1,
            opacity: !canSend ? 0.7 : 1,
          }}
        />

        <button
          onClick={send}
          disabled={!canSend}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            background: !canSend ? "#444" : "white",
            color: !canSend ? "#bbb" : "black",
            cursor: !canSend ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </main>
  );
}
