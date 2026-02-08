"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; text: string };

// ----------------------------
// SETTINGS
// ----------------------------
const MAX_USER_MESSAGES = 8;
const SESSION_MINUTES = 15;
const COOLDOWN_HOURS = 24;

// localStorage keys
const LS_SESSION = "bt_expression_session_v1";
const LS_COOLDOWN = "bt_expression_cooldown_v1";

type StoredSession = {
  startedAt: number | null; // set on first user send
  endedAt: number | null;
  userCount: number;
  log: ChatMsg[];
};

function nowMs() {
  return Date.now();
}

function msFromMinutes(m: number) {
  return m * 60 * 1000;
}

function msFromHours(h: number) {
  return h * 60 * 60 * 1000;
}

export default function ExpressionPage() {
  const [inviteCode, setInviteCode] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [session, setSession] = useState<StoredSession>({
    startedAt: null,
    endedAt: null,
    userCount: 0,
    log: [],
  });

  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  // tick for timer
  const [, forceTick] = useState(0);
  const tickRef = useRef<number | null>(null);

  // ----------------------------
  // LOAD persisted state
  // ----------------------------
  useEffect(() => {
    try {
      const rawSession = localStorage.getItem(LS_SESSION);
      if (rawSession) {
        const parsed = JSON.parse(rawSession) as StoredSession;
        setSession({
          startedAt: parsed.startedAt ?? null,
          endedAt: parsed.endedAt ?? null,
          userCount: parsed.userCount ?? 0,
          log: Array.isArray(parsed.log) ? parsed.log : [],
        });
      }
    } catch {}

    try {
      const rawCooldown = localStorage.getItem(LS_COOLDOWN);
      if (rawCooldown) {
        const parsed = JSON.parse(rawCooldown) as { until: number | null };
        setCooldownUntil(parsed.until ?? null);
      }
    } catch {}
  }, []);

  // ----------------------------
  // PERSIST state
  // ----------------------------
  useEffect(() => {
    try {
      localStorage.setItem(LS_SESSION, JSON.stringify(session));
    } catch {}
  }, [session]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_COOLDOWN, JSON.stringify({ until: cooldownUntil }));
    } catch {}
  }, [cooldownUntil]);

  // ----------------------------
  // TIMER tick every 1s while active
  // ----------------------------
  const sessionActive = Boolean(session.startedAt && !session.endedAt);

  useEffect(() => {
    if (!sessionActive) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }

    if (tickRef.current) return;

    tickRef.current = window.setInterval(() => {
      forceTick((x) => x + 1);
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [sessionActive]);

  // ----------------------------
  // derived state
  // ----------------------------
  const isCooldownActive = useMemo(() => {
    if (!cooldownUntil) return false;
    return nowMs() < cooldownUntil;
  }, [cooldownUntil]);

  const sessionExpiredByTime = useMemo(() => {
    if (!session.startedAt) return false;
    const deadline = session.startedAt + msFromMinutes(SESSION_MINUTES);
    return nowMs() >= deadline;
  }, [session.startedAt]);

  const remainingMs = useMemo(() => {
    if (!session.startedAt) return msFromMinutes(SESSION_MINUTES);
    const deadline = session.startedAt + msFromMinutes(SESSION_MINUTES);
    return Math.max(0, deadline - nowMs());
  }, [session.startedAt]);

  const remainingClock = useMemo(() => {
    const total = Math.floor(remainingMs / 1000);
    const mm = Math.floor(total / 60).toString().padStart(2, "0");
    const ss = (total % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }, [remainingMs]);

  const userMessagesLeft = useMemo(() => {
    return Math.max(0, MAX_USER_MESSAGES - session.userCount);
  }, [session.userCount]);

  const canSend = useMemo(() => {
    if (!inviteCode.trim()) return false;
    if (sending) return false;
    if (isCooldownActive) return false;
    if (session.endedAt) return false;
    if (sessionExpiredByTime) return false;
    if (session.userCount >= MAX_USER_MESSAGES) return false;
    return true;
  }, [inviteCode, sending, isCooldownActive, session.endedAt, sessionExpiredByTime, session.userCount]);

  const cooldownText = useMemo(() => {
    if (!cooldownUntil) return "";
    const ms = Math.max(0, cooldownUntil - nowMs());
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return `Locked. Try again in ~${hours}h ${mins}m.`;
  }, [cooldownUntil]);

  // ----------------------------
  // end session + start cooldown
  // ----------------------------
  function endSessionAndCooldown(finalAssistantText?: string) {
    const endedAt = nowMs();
    const until = endedAt + msFromHours(COOLDOWN_HOURS);

    setCooldownUntil(until);

    setSession((prev) => {
      const newLog = [...prev.log];
      if (finalAssistantText) newLog.push({ role: "assistant", text: finalAssistantText });
      return { ...prev, endedAt, log: newLog };
    });
  }

  // Auto-end on timer
  useEffect(() => {
    if (sessionActive && sessionExpiredByTime && !session.endedAt) {
      endSessionAndCooldown("We’ll leave it there. You can start another session if and when you choose.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionActive, sessionExpiredByTime, session.endedAt]);

  // ----------------------------
  // Clear chat view (ends active session => prevents bypass)
  // ----------------------------
  function clearChatView() {
    if (session.startedAt && !session.endedAt) {
      endSessionAndCooldown("We’ll leave it there. You can start another session if and when you choose.");
      return;
    }
    setSession((prev) => ({ ...prev, log: [] }));
  }

  // Start a new session (only after cooldown)
  function startNewSession() {
    if (isCooldownActive) return;

    setSession({
      startedAt: null,
      endedAt: null,
      userCount: 0,
      log: [],
    });
    setInput("");
  }

  const openingCopy = (
    <>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Start</div>
      <div>
        <div><strong>This is a tightly bounded reflection tool.</strong></div>
        <div>It won’t advise, reassure, or carry anything forward.</div>
        <div>Write whatever feels unresolved or unspoken.</div>
      </div>
    </>
  );

  // ----------------------------
  // Send message
  // ----------------------------
  async function send() {
    const userText = input.trim();
    if (!userText) return;
    if (!canSend) return;

    setInput("");

    // Determine sessionStartMs BEFORE updating state, so we can send it reliably.
    const sessionStartMs = session.startedAt ?? nowMs();

    // Update UI state first
    setSession((prev) => {
      const startedAt = prev.startedAt ?? sessionStartMs;
      const newLog: ChatMsg[] = [...prev.log, { role: "user", text: userText }];
      return {
        ...prev,
        startedAt,
        log: newLog,
        userCount: prev.userCount + 1,
      };
    });

    setSending(true);

    try {
      const nextUserCount = session.userCount + 1;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "expression",
          inviteCode: inviteCode.trim(),
          userText,
          // ✅ this fixes your error:
          sessionStartMs,
          // optional, so server can enforce limits too:
          userMessageCount: nextUserCount,
        }),
      });

      const data = await res.json().catch(() => ({}));
      setSending(false);

      if (!res.ok) {
        const errText = data?.error ? `Error: ${data.error}` : `Error: HTTP ${res.status}`;
        setSession((prev) => ({ ...prev, log: [...prev.log, { role: "assistant", text: errText }] }));
        return;
      }

      const outputText: string = (data?.output ?? "").toString();
      const closed: boolean = Boolean(data?.closed);

      setSession((prev) => ({
        ...prev,
        log: [...prev.log, { role: "assistant", text: outputText || "(no response)" }],
      }));

      // If server says session is closed, enforce cooldown immediately
      if (closed) {
        endSessionAndCooldown();
        return;
      }

      // If we hit local cap, end after reply
      if (nextUserCount >= MAX_USER_MESSAGES) {
        endSessionAndCooldown("We’ll leave it there. You can start another session if and when you choose.");
      }
    } catch {
      setSending(false);
      setSession((prev) => ({
        ...prev,
        log: [...prev.log, { role: "assistant", text: "assistant: Network error" }],
      }));
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0b0b", color: "white", padding: 30 }}>
      <a href="/" style={{ color: "white", opacity: 0.75, textDecoration: "none" }}>
        ← Back
      </a>

      <h1 style={{ fontSize: 34, marginTop: 14, marginBottom: 6 }}>Expression — Beta</h1>
      <div style={{ opacity: 0.85, lineHeight: 1.5, marginBottom: 18 }}>
        Short responses. No advice. No reassurance. No memory. <br />
        Sessions end deliberately.
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Invite code"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "white",
            minWidth: 260,
            flex: 1,
          }}
        />

        <button
          onClick={clearChatView}
          disabled={sending}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "white",
            cursor: sending ? "not-allowed" : "pointer",
            opacity: sending ? 0.6 : 1,
          }}
        >
          Clear chat view
        </button>

        <button
          onClick={startNewSession}
          disabled={isCooldownActive}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: isCooldownActive ? "transparent" : "white",
            color: isCooldownActive ? "white" : "black",
            cursor: isCooldownActive ? "not-allowed" : "pointer",
            fontWeight: 700,
            opacity: isCooldownActive ? 0.6 : 1,
          }}
          title={isCooldownActive ? cooldownText : "Start a new session"}
        >
          New session
        </button>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 14,
          padding: 16,
          minHeight: 340,
        }}
      >
        {!inviteCode.trim() ? (
          <div style={{ opacity: 0.8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Enter your invite code to begin.</div>
            <div style={{ marginTop: 14 }}>{openingCopy}</div>
          </div>
        ) : session.log.length === 0 ? (
          <div style={{ opacity: 0.85 }}>{openingCopy}</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {session.log.map((m, idx) => (
              <div key={idx}>
                <div style={{ fontWeight: 800, opacity: 0.85 }}>{m.role}</div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.text}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 14, opacity: 0.75, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>User messages: {session.userCount}/{MAX_USER_MESSAGES} (left: {userMessagesLeft})</div>
          <div>Session timer: {session.startedAt && !session.endedAt ? remainingClock : "15:00"}</div>
          {isCooldownActive && <div style={{ fontWeight: 700 }}>{cooldownText}</div>}
          {session.endedAt && !isCooldownActive && <div style={{ fontWeight: 700 }}>Session ended. You can start a new one.</div>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type…"
          rows={3}
          style={{
            flex: 1,
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            color: "white",
            resize: "vertical",
          }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          style={{
            padding: "14px 18px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: canSend ? "white" : "transparent",
            color: canSend ? "black" : "white",
            cursor: canSend ? "pointer" : "not-allowed",
            fontWeight: 800,
            minWidth: 110,
            opacity: canSend ? 1 : 0.65,
          }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.65, lineHeight: 1.5 }}>
        Note: Clearing the chat during an active session ends the session and starts the cooldown (prevents bypassing the 24h rule).
      </div>
    </main>
  );
}
