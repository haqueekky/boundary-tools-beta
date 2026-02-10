"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatMsg = { role: "user" | "assistant"; text: string };

const MAX_USER_MESSAGES = 8;
const SESSION_MINUTES = 15;
const COOLDOWN_HOURS = 24;

const LS_SESSION = "bt_decision_session_v1";
const LS_COOLDOWN = "bt_decision_cooldown_v1";

type StoredSession = {
  startedAt: number | null;
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

export default function DecisionBoundaryPage() {
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

  const [, forceTick] = useState(0);
  const tickRef = useRef<number | null>(null);

  // Load state
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

  // Persist state
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

  const sessionActive = Boolean(session.startedAt && !session.endedAt);

  // Tick timer during active session
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

  const cooldownText = useMemo(() => {
    if (!cooldownUntil) return "";
    const ms = Math.max(0, cooldownUntil - nowMs());
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return `Locked. Try again in ~${hours}h ${mins}m.`;
  }, [cooldownUntil]);

  const canSend = useMemo(() => {
    if (!inviteCode.trim()) return false;
    if (sending) return false;
    if (isCooldownActive) return false;
    if (session.endedAt) return false;
    if (sessionExpiredByTime) return false;
    if (session.userCount >= MAX_USER_MESSAGES) return false;
    return true;
  }, [
    inviteCode,
    sending,
    isCooldownActive,
    session.endedAt,
    sessionExpiredByTime,
    session.userCount,
  ]);

  function startCooldownAndEndSession() {
    const endedAt = nowMs();
    const until = endedAt + msFromHours(COOLDOWN_HOURS);

    setCooldownUntil(until);
    setSession((prev) => ({
      ...prev,
      endedAt,
    }));
  }

  // Auto-end on timer
  useEffect(() => {
    if (sessionActive && sessionExpiredByTime && !session.endedAt) {
      startCooldownAndEndSession();
      setSession((prev) => ({
        ...prev,
        log: [
          ...prev.log,
          {
            role: "assistant",
            text: "We’ll leave it there. You can return to this if and when you choose.",
          },
        ],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionActive, sessionExpiredByTime, session.endedAt]);

  function clearChatView() {
    // Clearing DURING an active session ends it + starts cooldown (prevents bypass)
    if (session.startedAt && !session.endedAt) {
      setSession((prev) => ({
        ...prev,
        log: [
          ...prev.log,
          {
            role: "assistant",
            text: "We’ll leave it there. You can return to this if and when you choose.",
          },
        ],
        endedAt: nowMs(),
      }));
      setCooldownUntil(nowMs() + msFromHours(COOLDOWN_HOURS));
      return;
    }

    // Otherwise just clear visible log
    setSession((prev) => ({ ...prev, log: [] }));
  }

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

  const opening = (
    <>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Decision Boundary</div>
      <div style={{ lineHeight: 1.5 }}>
        <div>This is a tightly bounded space for holding a decision.</div>
        <div>Nothing here will advise, optimise, or resolve it.</div>
        <div style={{ marginTop: 10 }}>Write the decision as it currently sits with you.</div>
      </div>
    </>
  );

  async function send() {
    const userText = input.trim();
    if (!userText) return;
    if (!canSend) return;

    setInput("");

    const sessionStartMs = session.startedAt ?? nowMs();
    const nextUserCount = session.userCount + 1;

    // Optimistic UI update
    setSession((prev) => ({
      ...prev,
      startedAt: prev.startedAt ?? sessionStartMs,
      userCount: prev.userCount + 1,
      log: [...prev.log, { role: "user", text: userText }],
    }));

    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "decision",
          inviteCode: inviteCode.trim(),
          userText,
          sessionStartMs,
          userMessageCount: nextUserCount,
        }),
      });

      const data = await res.json().catch(() => ({}));
      setSending(false);

      if (!res.ok) {
        const errText = data?.error ? `Error: ${data.error}` : `Error: HTTP ${res.status}`;
        setSession((prev) => ({
          ...prev,
          log: [...prev.log, { role: "assistant", text: errText }],
        }));
        return;
      }

      const outputText: string = (data?.output ?? "").toString();
      const closed: boolean = Boolean(data?.closed);

      setSession((prev) => ({
        ...prev,
        log: [...prev.log, { role: "assistant", text: outputText || "(no response)" }],
      }));

      // If server closes it, start cooldown and stop
      if (closed) {
        startCooldownAndEndSession();
        return;
      }

      // Client-side safety end
      if (nextUserCount >= MAX_USER_MESSAGES) {
        startCooldownAndEndSession();
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

      <h1 style={{ fontSize: 34, marginTop: 14, marginBottom: 6 }}>Decision — Beta</h1>
      <div style={{ opacity: 0.85, lineHeight: 1.5, marginBottom: 18 }}>
        Short responses. No advice. No recommendations. No optimisation.
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
            fontWeight: 800,
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
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Enter your invite code to begin.</div>
            <div style={{ marginTop: 14 }}>{opening}</div>
          </div>
        ) : session.log.length === 0 ? (
          <div style={{ opacity: 0.85 }}>{opening}</div>
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
          {isCooldownActive && <div style={{ fontWeight: 800 }}>{cooldownText}</div>}
          {session.endedAt && !isCooldownActive && (
            <div style={{ fontWeight: 800 }}>Session ended. You can start a new one.</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g., "I’m expected to decide, but the conditions keep shifting."'
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
            fontWeight: 900,
            minWidth: 110,
            opacity: canSend ? 1 : 0.65,
          }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.65, lineHeight: 1.5 }}>
        Note: Clearing the chat during an active session ends the session and starts the cooldown (prevents bypassing the
        24h rule).
      </div>
    </main>
  );
}
