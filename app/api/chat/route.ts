import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";

type Body = {
  tool?: keyof typeof PROMPTS;
  inviteCode?: string;
  userText: string;

  // ✅ NEW: the UI will send this; but we treat it as optional to avoid crashes
  sessionStartMs?: number;

  // optional counters (client-side)
  userMessageCount?: number;
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 20000,
});

// You can also enforce on the server if you want.
const MAX_USER_MESSAGES = 8;
const SESSION_MINUTES = 15;

function nowMs() {
  return Date.now();
}

function msFromMinutes(m: number) {
  return m * 60 * 1000;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const userText = (body.userText ?? "").trim();
    if (!userText) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    // Invite code check (only if you set INVITE_CODE in env)
    if (process.env.INVITE_CODE && body.inviteCode !== process.env.INVITE_CODE) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
    }

    const tool = body.tool ?? "expression";
    const system = PROMPTS[tool];
    if (!system) {
      return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
    }

    // ✅ Session start: do NOT throw if missing.
    // If the client doesn't send it for some reason, we safely infer it.
    const sessionStartMs =
      typeof body.sessionStartMs === "number" && Number.isFinite(body.sessionStartMs)
        ? body.sessionStartMs
        : nowMs();

    // ✅ Enforce 15-minute timer server-side (prevents client bypass)
    const deadline = sessionStartMs + msFromMinutes(SESSION_MINUTES);
    if (nowMs() >= deadline) {
      return NextResponse.json({
        output: "We’ll leave it there. You can start another session if and when you choose.",
        closed: true,
        reason: "time",
      });
    }

    // ✅ Enforce message cap server-side (prevents client bypass)
    if (typeof body.userMessageCount === "number" && body.userMessageCount >= MAX_USER_MESSAGES) {
      return NextResponse.json({
        output: "We’ll leave it there. You can start another session if and when you choose.",
        closed: true,
        reason: "count",
      });
    }

    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      input: [
        { role: "system", content: system },
        { role: "user", content: userText },
      ],
    });

    return NextResponse.json({
      output: resp.output_text ?? "",
      closed: false,
      sessionStartMs, // return for debugging if needed
    });
  } catch (err: any) {
    // Helpful server logs without exposing secrets
    console.error("api/chat error:", err?.message || err);

    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
