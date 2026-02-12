import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 20000,
});

const MAX_USER_MESSAGES = 8;
const MAX_SESSION_MS = 15 * 60 * 1000; // 15 minutes

type Body = {
  tool: keyof typeof PROMPTS;
  inviteCode?: string;
  userText: string;
  userMessageCount: number; // count BEFORE this message
  sessionStartMs: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.userText?.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    // Invite code protection
    if (process.env.INVITE_CODE && body.inviteCode !== process.env.INVITE_CODE) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
    }

    // Session timer
    const now = Date.now();
    if (now - body.sessionStartMs > MAX_SESSION_MS) {
      return NextResponse.json({
        output:
          "The session time limit has been reached.\n\nWe’ll leave it there.\n\nYou can start another session if and when you choose.",
      });
    }

    const isFinalMessage =
      body.userMessageCount + 1 >= MAX_USER_MESSAGES;

    const systemPrompt = PROMPTS[body.tool];

    if (!systemPrompt) {
      return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: body.userText },
      ],
    });

    let output = response.output_text ?? "";

    // Only append closing block if this is truly the final allowed message
    if (isFinalMessage) {
      output =
        output.trim() +
        "\n\nWe’ll leave it there.\n\nYou can start another session if and when you choose.";
    }

    return NextResponse.json({ output });
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
