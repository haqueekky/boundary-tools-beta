import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_USER_MESSAGES = 8;
const MAX_SESSION_MS = 15 * 60 * 1000;

type Body = {
  tool?: keyof typeof PROMPTS;
  inviteCode?: string;
  userText: string;

  // client-provided session tracking
  userMessageCount?: number; // how many user messages have been sent in THIS session so far (before this one)
  sessionStartMs?: number; // epoch ms at session start
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  const userText = body.userText?.trim();
  if (!userText) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  if (process.env.INVITE_CODE && body.inviteCode !== process.env.INVITE_CODE) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
  }

  const tool = body.tool ?? "expression";
  const systemBase = PROMPTS[tool];
  if (!systemBase) return NextResponse.json({ error: "Unknown tool" }, { status: 400 });

  const countBefore = body.userMessageCount ?? 0;
  const startMs = body.sessionStartMs;

  // If startMs missing, treat as client bug (prevents silent bypass)
  if (!startMs) {
    return NextResponse.json({ error: "Missing sessionStartMs" }, { status: 400 });
  }

  const now = Date.now();
  const expiredByTime = now - startMs >= MAX_SESSION_MS;
  const isFinalByCount = countBefore + 1 >= MAX_USER_MESSAGES;
  const shouldEndNow = expiredByTime || isFinalByCount;

  // Add a small system suffix ONLY when ending
  const system = shouldEndNow ? `${systemBase}\n\nSESSION_END_NOW` : systemBase;

  const resp = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
  });

  return NextResponse.json({
    output: resp.output_text ?? "",
    ended: shouldEndNow,
    expiredByTime,
    userMessagesUsed: countBefore + 1,
    maxUserMessages: MAX_USER_MESSAGES,
  });
}
