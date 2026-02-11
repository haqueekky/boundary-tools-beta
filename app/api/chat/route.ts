import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";

const MAX_USER_MESSAGES = 8;
const MAX_SESSION_MS = 15 * 60 * 1000; // 15 minutes

type Body = {
  tool?: keyof typeof PROMPTS;
  userText: string;
  inviteCode?: string;
  userMessageCount?: number; // number of user messages already sent BEFORE this one
  sessionStartMs?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    // --- Invite gate (server-side) ---
    const requiredCode = process.env.INVITE_CODE || "test123";
    const providedCode = (body.inviteCode ?? "").trim();

    if (!providedCode || providedCode !== requiredCode) {
      return NextResponse.json(
        { output: "Invalid invite code." },
        { status: 401 }
      );
    }

    const userText = body.userText?.trim();
    if (!userText) {
      return NextResponse.json({ output: "Empty message." }, { status: 400 });
    }

    const tool = body.tool ?? "expression";
    const systemPrompt = PROMPTS[tool];
    if (!systemPrompt) {
      return NextResponse.json({ output: "Unknown tool." }, { status: 400 });
    }

    const userCount = body.userMessageCount ?? 0;
    const sessionStart = body.sessionStartMs;

    if (!sessionStart) {
      return NextResponse.json(
        { output: "Error: Missing sessionStartMs" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const timeExceeded = now - sessionStart >= MAX_SESSION_MS;

    // If userCount === 7, this incoming message is the 8th
    const messageExceeded = userCount === MAX_USER_MESSAGES - 1;

    const sessionEnding = timeExceeded || messageExceeded;

    const finalUserInput = sessionEnding
      ? `${userText}\n\nSESSION_END_NOW`
      : userText;

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY missing");
      return NextResponse.json(
        { output: "Server configuration error." },
        { status: 500 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 20000,
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: finalUserInput },
      ],
    });

    let output = response.output_text ?? "";

    // Force spacing before the closing line if this is session end
    if (sessionEnding) {
      output = output.replace(
        "We’ll leave it there. You can start another session if and when you choose.",
        "\n\nWe’ll leave it there. You can start another session if and when you choose."
      );
    }

    return NextResponse.json({
      output,
      locked: sessionEnding,
    });
  } catch (err) {
    console.error("API ERROR:", err);
    return NextResponse.json({ output: "Error: HTTP 500" }, { status: 500 });
  }
}
