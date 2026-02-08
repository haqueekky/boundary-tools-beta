import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";

type Body = {
  tool?: keyof typeof PROMPTS;
  inviteCode?: string;
  userText: string;

  // Optional but recommended (client sends it)
  sessionStartMs?: number;

  // Optional counter from client so server can close exactly on message 8
  userMessageCount?: number;
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 20000,
});

const MAX_USER_MESSAGES = 8;
const SESSION_MINUTES = 15;

function nowMs() {
  return Date.now();
}

function msFromMinutes(m: number) {
  return m * 60 * 1000;
}

/**
 * Neutral acknowledgement:
 * - short
 * - no advice
 * - no reassurance
 * - lightly references what was said without reprinting everything
 */
function acknowledge(userText: string) {
  const cleaned = userText.replace(/\s+/g, " ").trim();
  const snippet = cleaned.length > 90 ? cleaned.slice(0, 90) + "…" : cleaned;

  // Neutral “touch” line that doesn’t validate conclusions or advise.
  // It acknowledges *content* exists and was stated.
  return `You’ve put this into words: “${snippet}”.`;
}

const CLOSING_LINE = "We’ll leave it there. You can start another session if and when you choose.";

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

    // Session start (optional): if missing, infer now (avoid hard failure)
    const sessionStartMs =
      typeof body.sessionStartMs === "number" && Number.isFinite(body.sessionStartMs)
        ? body.sessionStartMs
        : nowMs();

    // Server-side timer enforcement
    const deadline = sessionStartMs + msFromMinutes(SESSION_MINUTES);
    const isTimeOver = nowMs() >= deadline;

    // Server-side message limit enforcement
    const count =
      typeof body.userMessageCount === "number" && Number.isFinite(body.userMessageCount)
        ? body.userMessageCount
        : null;

    const isFinalByCount = count !== null && count >= MAX_USER_MESSAGES;

    // If time is already over, we close immediately with acknowledgement + closing
    if (isTimeOver) {
      return NextResponse.json({
        output: `${acknowledge(userText)}\n\n${CLOSING_LINE}`,
        closed: true,
        reason: "time",
      });
    }

    // Normal model call
    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      input: [
        { role: "system", content: system },
        { role: "user", content: userText },
      ],
    });

    const modelText = (resp.output_text ?? "").trim();

    // If this is the final message by count, we append acknowledgement + closing
    // and end the session immediately after the model response.
    if (isFinalByCount) {
      const ack = acknowledge(userText);
      const output = `${modelText}\n\n${ack}\n\n${CLOSING_LINE}`.trim();
      return NextResponse.json({
        output,
        closed: true,
        reason: "count",
      });
    }

    return NextResponse.json({
      output: modelText,
      closed: false,
    });
  } catch (err: any) {
    console.error("api/chat error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
