import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";
import crypto from "crypto";

export const runtime = "nodejs";

type Tool = keyof typeof PROMPTS;

type Body = {
  tool: Tool;
  inviteCode?: string;
  userText: string;
  userMessageCount: number; // count BEFORE this message
  sessionStartMs: number; // client-provided session start
};

const MAX_SESSION_MS = 15 * 60 * 1000;

const MAX_USER_MESSAGES_BY_TOOL: Record<Tool, number> = {
  expression: 8,
  decision: 5,
};

const DAILY_SESSIONS_BY_TOOL: Record<Tool, number> = {
  expression: 1,
  decision: 3,
};

const USAGE_COOKIE = "bt_usage_v1";

const SIGNING_SECRET =
  process.env.BT_COOKIE_SECRET || process.env.INVITE_CODE || "dev-secret-change-me";

type UsageState = {
  day: string;
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
  return crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("base64url");
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
        if (block?.type === "output_text" && typeof block?.text === "string" && block.text.trim()) {
          chunks.push(block.text);
          continue;
        }
        if (typeof block?.text === "string" && block.text.trim()) {
          chunks.push(block.text);
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.userText?.trim()) {
      return NextResponse.json({ output: "Error: Empty message", locked: false }, { status: 400 });
    }

    if (process.env.INVITE_CODE && body.inviteCode !== process.env.INVITE_CODE) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
    }

    const tool = body.tool;
    const systemPrompt = PROMPTS[tool];
    if (!systemPrompt) {
      return NextResponse.json({ output: "Error: Unknown tool", locked: false }, { status: 400 });
    }

    const now = Date.now();
    if (now - body.sessionStartMs > MAX_SESSION_MS) {
      return NextResponse.json({ output: closeText("The session time limit has been reached."), locked: true });
    }

    const maxUserMessages = MAX_USER_MESSAGES_BY_TOOL[tool] ?? 8;
    const isFinalMessage = body.userMessageCount + 1 >= maxUserMessages;

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
        return NextResponse.json({ output: closeText("Daily session limit reached."), locked: true });
      }

      usage.sessions[tool] = current + 1;
      const updated = makeUsageState(usage.day, usage.sessions);
      setUsageCookie = encodeURIComponent(JSON.stringify(updated));
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json({ output: "Error: OPENAI_API_KEY missing", locked: false }, { status: 500 });
    }

    const client = new OpenAI({ apiKey, timeout: 20000 });
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const response = await client.responses.create({
      model,
      temperature: 0.2,
      max_output_tokens: 200,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: body.userText },
      ],
    });

    let output = extractResponseText(response);

    if (!output) {
      const r = NextResponse.json(
        { output: "Error: Empty response from model.", locked: false },
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
      output =
        output.trim() +
        "\n\nWe’ll leave it there.\n\nYou can start another session if and when you choose.";
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
    return NextResponse.json({ output: "Error: Server error", locked: false }, { status: 500 });
  }
}
