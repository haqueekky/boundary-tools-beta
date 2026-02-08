import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";

type Body = {
  tool?: keyof typeof PROMPTS;
  inviteCode?: string;
  userText: string;
  sessionStartMs?: number;
  userMessageCount?: number;
};

const MAX_USER_MESSAGES = 8;
const SESSION_MINUTES = 15;

function nowMs() {
  return Date.now();
}

function msFromMinutes(m: number) {
  return m * 60 * 1000;
}

function acknowledge(userText: string) {
  const cleaned = userText.replace(/\s+/g, " ").trim();
  const snippet = cleaned.length > 90 ? cleaned.slice(0, 90) + "…" : cleaned;
  return `You’ve put this into words: “${snippet}”.`;
}

const CLOSING_LINE = "We’ll leave it there. You can start another session if and when you choose.";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const userText = (body.userText ?? "").trim();
    if (!userText) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    if (process.env.INVITE_CODE && body.inviteCode !== process.env.INVITE_CODE) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
    }

    const tool = body.tool ?? "expression";
    const system = PROMPTS[tool];
    if (!system) return NextResponse.json({ error: "Unknown tool" }, { status: 400 });

    // ✅ IMPORTANT: read env + create client only at request time (runtime)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfigured: OPENAI_API_KEY missing" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey, timeout: 20000 });

    const sessionStartMs =
      typeof body.sessionStartMs === "number" && Number.isFinite(body.sessionStartMs)
        ? body.sessionStartMs
        : nowMs();

    const deadline = sessionStartMs + msFromMinutes(SESSION_MINUTES);
    const isTimeOver = nowMs() >= deadline;

    const count =
      typeof body.userMessageCount === "number" && Number.isFinite(body.userMessageCount)
        ? body.userMessageCount
        : null;

    const isFinalByCount = count !== null && count >= MAX_USER_MESSAGES;

    if (isTimeOver) {
      return NextResponse.json({
        output: `${acknowledge(userText)}\n\n${CLOSING_LINE}`,
        closed: true,
        reason: "time",
      });
    }

    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      input: [
        { role: "system", content: system },
        { role: "user", content: userText },
      ],
    });

    const modelText = (resp.output_text ?? "").trim();

    if (isFinalByCount) {
      const output = `${modelText}\n\n${acknowledge(userText)}\n\n${CLOSING_LINE}`.trim();
      return NextResponse.json({ output, closed: true, reason: "count" });
    }

    return NextResponse.json({ output: modelText, closed: false });
  } catch (err: any) {
    console.error("api/chat error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
