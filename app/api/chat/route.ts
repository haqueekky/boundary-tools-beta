import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Tool = keyof typeof PROMPTS;

type Body = {
  tool: Tool;
  inviteCode?: string;
  userText: string;

  // count BEFORE this message
  userMessageCount: number;

  // client-provided session start
  sessionStartMs: number;
};

const MAX_SESSION_MS = 15 * 60 * 1000; // 15 minutes

// Per-session message limits (user messages)
const MAX_USER_MESSAGES_BY_TOOL: Record<Tool, number> = {
  expression: 8,
  decision: 5,
};

// Daily session caps (per tool)
const DAILY_SESSIONS_BY_TOOL: Record<Tool, number> = {
  expression: 1,
  decision: 3,
};

const USAGE_COOKIE = "bt_usage_v1";

// Used only to sign the cookie (no content stored).
const SIGNING_SECRET =
  process.env.BT_COOKIE_SECRET ||
  process.env.INVITE_CODE ||
  "dev-secret-change-me";

type UsageState = {
  day: string; // YYYY-MM-DD (UTC)
  sessions: Record<Tool, number>;
  sig: string;
};

function todayKeyUTC(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function hmac(payload: string): string {
  return crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("base64url");
}

function safeParseUsage(raw?: string | null): UsageState | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as UsageState;
    if (!obj?.day || !obj?.sessions || !obj?.sig) return null;

    const payload = JSON.stringify({ day: obj.day, sessions: obj.sessions });
    const expected = hmac(payload);
    if (expected !== obj.sig) return null;

    return obj;
  } catch {
    return null;
  }
}

function makeUsageState(day: string, sessions: Record<Tool, number>): UsageState {
  const payload = JSON.stringify({ day, sessions });
  return { day, sessions, sig: hmac(payload) };
}

function closeText(prefix: string) {
  return `${prefix}\n\nWe’ll leave it there.\n\nYou can start another session if and when you choose.`;
}

function getCookieValue(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const part = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!part) return null;
  return part.slice(name.length + 1);
}

// Conservative mixed-language detection: only triggers on TWO different scripts
function isMixedLanguageTwoScripts(text: string): boolean {
  const hasLatin = /[A-Za-z]/.test(text) && (text.match(/[A-Za-z]/g)?.length ?? 0) >= 20;

  // Non-latin scripts (broad but safe)
  const nonLatinMatches =
    text.match(
      /[\u0E00-\u0E7F\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g
    ) ?? [];
  const hasNonLatin = nonLatinMatches.length >= 10;

  return hasLatin && hasNonLatin;
}

// Bulletproof extraction for Responses API across variants
function extractResponseText(response: any): string {
  const chunks: string[] = [];

  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    chunks.push(response.output_text);
  }

  const out = response?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;

      for (const block of content) {
        if (block?.type === "output_text" && typeof block?.text === "string") {
          if (block.text.trim()) chunks.push(block.text);
          continue;
        }

        if (typeof block?.text === "string" && block.text.trim()) {
          chunks.push(block.text);
          continue;
        }

        const nested = block?.output_text;
        if (typeof nested === "string" && nested.trim()) {
          chunks.push(nested);
          continue;
        }

        if (typeof block?.content === "string" && block.content.trim()) {
          chunks.push(block.content);
          continue;
        }
      }
    }
  }

  return chunks.join("").trim();
}

function stripClosingIfPresent(text: string): string {
  const patterns = [
    /We[’']ll leave it there\.\s*/gi,
    /You can start another session if and when you choose\.\s*/gi,
  ];

  let t = text;
  for (const p of patterns) t = t.replace(p, "");
  return t.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const userText = (body.userText ?? "").trim();
    if (!userText) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    // Invite code protection
    if (process.env.INVITE_CODE && body.inviteCode !== process.env.INVITE_CODE) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
    }

    const tool = body.tool;
    const systemPrompt = PROMPTS[tool];
    if (!systemPrompt) {
      return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
    }

    // Session timer
    const now = Date.now();
    if (now - body.sessionStartMs > MAX_SESSION_MS) {
      return NextResponse.json({
        output: closeText("The session time limit has been reached."),
        locked: true,
      });
    }

    // Per-session message cap
    const maxUserMessages = MAX_USER_MESSAGES_BY_TOOL[tool] ?? 8;
    const isFinalMessage = body.userMessageCount + 1 >= maxUserMessages;

    // Daily cap: count a session only when the first user message is sent
    const isFirstUserMessage = body.userMessageCount === 0;

    const today = todayKeyUTC();
    const rawCookie = getCookieValue(req, USAGE_COOKIE);
    const decoded = rawCookie ? decodeURIComponent(rawCookie) : null;

    let usage = safeParseUsage(decoded);
    if (!usage || usage.day !== today) {
      usage = makeUsageState(today, { expression: 0, decision: 0 });
    }

    let setUsageCookie: string | null = null;

    if (isFirstUserMessage) {
      const limit = DAILY_SESSIONS_BY_TOOL[tool] ?? 1;
      const current = usage.sessions[tool] ?? 0;

      if (current >= limit) {
        return NextResponse.json({
          output: closeText("Daily session limit reached."),
          locked: true,
        });
      }

      usage.sessions[tool] = current + 1;
      const updated = makeUsageState(usage.day, usage.sessions);
      setUsageCookie = encodeURIComponent(JSON.stringify(updated));
    }

    // Mixed-language check (server-side, conservative)
    if (isMixedLanguageTwoScripts(userText)) {
      const res = NextResponse.json({
        output: "You’re mixing languages. Which language would you like to use for this session?",
        locked: false,
      });

      if (setUsageCookie) {
        res.cookies.set(USAGE_COOKIE, setUsageCookie, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
      }

      return res;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
    }

    const client = new OpenAI({ apiKey, timeout: 20000 });
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const response = await client.responses.create({
      model,
      temperature: 0.2,
      max_output_tokens: tool === "decision" ? 90 : 140,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
    });

    let output = extractResponseText(response);
    output = stripClosingIfPresent(output);

    if (!output.trim()) {
      const r = NextResponse.json(
        { error: "Empty response from model", locked: false },
        { status: 502 }
      );

      if (setUsageCookie) {
        r.cookies.set(USAGE_COOKIE, setUsageCookie, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
      }

      return r;
    }

    if (isFinalMessage) {
      output = output.trim() + "\n\nWe’ll leave it there.\n\nYou can start another session if and when you choose.";
    }

    const resJson = NextResponse.json({ output, locked: isFinalMessage });

    if (setUsageCookie) {
      resJson.cookies.set(USAGE_COOKIE, setUsageCookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return resJson;
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
