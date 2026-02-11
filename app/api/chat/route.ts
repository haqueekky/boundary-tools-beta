import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";

const MAX_USER_MESSAGES = 8;
const MAX_SESSION_MS = 15 * 60 * 1000; // 15 minutes

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 20000,
});

type Body = {
  tool?: keyof typeof PROMPTS;
  inviteCode?: string;
  userText: string;
  userMessageCount?: number;
  sessionStartMs?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.userText?.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const tool = body.tool ?? "expression";
    const systemPrompt = PROMPTS[tool];

    if (!systemPrompt) {
      return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
    }

    const now = Date.now();
    const start = body.sessionStartMs ?? now;
    const elapsed = now - start;

    const userCount = body.userMessageCount ?? 0;

    const limitReached =
      userCount >= MAX_USER_MESSAGES || elapsed >= MAX_SESSION_MS;

    // If limit already reached BEFORE this message
    if (limitReached) {
      return NextResponse.json({
        output:
          "We’ll leave it there. You can start another session if and when you choose.",
        locked: true,
      });
    }

    // If this message triggers the limit
    const willBeFinal =
      userCount + 1 >= MAX_USER_MESSAGES ||
      elapsed >= MAX_SESSION_MS;

    const finalFlag = willBeFinal ? "\n\nSESSION_END_NOW" : "";

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: body.userText + finalFlag },
      ],
    });

    return NextResponse.json({
      output: response.output_text ?? "",
      locked: willBeFinal,
      sessionStartMs: start,
    });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
