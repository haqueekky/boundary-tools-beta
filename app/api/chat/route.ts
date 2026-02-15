import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 20000,
});

// Session limits
const MAX_USER_MESSAGES = 8;
const MAX_SESSION_MS = 15 * 60 * 1000; // 15 minutes

// Keep this small to reduce cost + reduce drift without "therapy creep"
const MAX_HISTORY_ITEMS = 12; // total items (user+assistant) from prior log, not counting current user msg

const TEMPERATURE = 0.35;

type LogItem = { role: "user" | "assistant"; text: string };

type Body = {
  tool: keyof typeof PROMPTS;
  inviteCode?: string;

  // current message
  userText: string;

  // count BEFORE this message (still useful for UI & final-message detection)
  userMessageCount: number;

  // session timing from client
  sessionStartMs: number;

  // prior transcript from client (stateless; server does not store)
  history?: LogItem[];
};

function clampHistory(history: LogItem[] | undefined): LogItem[] {
  if (!history || !Array.isArray(history)) return [];
  const cleaned = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .map((m) => ({ role: m.role, text: m.text.trim() }))
    .filter((m) => m.text.length > 0);

  // Keep only the most recent N items
  return cleaned.slice(-MAX_HISTORY_ITEMS);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const tool = body?.tool;
    const userText = body?.userText?.trim() ?? "";

    if (!userText) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    // Invite code protection (optional)
    if (process.env.INVITE_CODE && body.inviteCode !== process.env.INVITE_CODE) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 401 });
    }

    const systemPrompt = tool ? PROMPTS[tool] : undefined;
    if (!systemPrompt) {
      return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
    }

    const now = Date.now();

    // Session timer
    if (now - body.sessionStartMs > MAX_SESSION_MS) {
      return NextResponse.json({
        output:
          "The session time limit has been reached.\n\nWe’ll leave it there.\n\nYou can start another session if and when you choose.",
        locked: true,
      });
    }

    const isFinalMessage = body.userMessageCount + 1 >= MAX_USER_MESSAGES;

    // Stateless continuity: take client-provided history (no server storage)
    const history = clampHistory(body.history);

    const input: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.text })),
      { role: "user", content: userText },
    ];

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: TEMPERATURE,
      input,
    });

    let output = (response.output_text ?? "").trim();

    // Append closing block only on final message
    if (isFinalMessage) {
      output += "\n\nWe’ll leave it there.\n\nYou can start another session if and when you choose.";
    }

    return NextResponse.json({
      output,
      locked: isFinalMessage,
    });
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
