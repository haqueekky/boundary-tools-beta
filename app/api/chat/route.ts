import OpenAI from "openai";
import { NextResponse } from "next/server";
import { PROMPTS } from "@/lib/prompts";

const MAX_USER_MESSAGES = 8;
const LOCK_HOURS = 24;
const LOCK_MS = LOCK_HOURS * 60 * 60 * 1000;

function parseCookies(cookieHeader: string | null) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;

  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

export async function POST(req: Request) {
  try {
    // 1) Enforce 24h lock (server-side, authoritative)
    const cookieHeader = req.headers.get("cookie");
    const cookies = parseCookies(cookieHeader);

    const lockUntil = Number(cookies.bt_lock_until || 0);
    const now = Date.now();

    if (lockUntil && now < lockUntil) {
      // Locked: do not call the model
      return NextResponse.json(
        {
          output:
            "We’ll leave it there.\n\nYou can start another session if and when you choose.",
          lockUntil,
          locked: true,
        },
        { status: 429 }
      );
    }

    // 2) Normal API key check
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const userText = (body.userText || "").trim();
    const userMessageCount = Number(body.userMessageCount || 0);

    if (!userText) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    // Invite-only gate
    if (
      process.env.INVITE_CODE &&
      body.inviteCode !== process.env.INVITE_CODE
    ) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 401 }
      );
    }

    // Hard stop: no model call if they’re already over the limit
    if (userMessageCount > MAX_USER_MESSAGES) {
      const res = NextResponse.json({
        output:
          "We’ll leave it there.\n\nYou can start another session if and when you choose.",
        locked: false,
      });
      return res;
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 20000,
    });

    const isFinalTurn = userMessageCount === MAX_USER_MESSAGES;

    const systemPrompt = isFinalTurn
      ? `${PROMPTS.expression}

FINAL TURN RULE:
- This is the last message of the session.
- Write ONE short, neutral acknowledgement of the user’s last message.
- Do NOT reassure, advise, validate, or suggest next steps.
- Keep it to one sentence.
- Do not mention limits or rules.`
      : PROMPTS.expression;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
    });

    const text = (response.output_text || "").trim();

    // 3) On the final turn, set the 24h lock cookie
    if (isFinalTurn) {
      const newLockUntil = Date.now() + LOCK_MS;

      const res = NextResponse.json({
        output: `${text}\n\nWe’ll leave it there.\n\nYou can start another session if and when you choose.`,
        lockUntil: newLockUntil,
        locked: true,
      });

      // Cookie visible to server; UI will also store lock in localStorage for display.
      // SameSite=Lax is fine for your use-case.
      res.headers.append(
        "Set-Cookie",
        `bt_lock_until=${encodeURIComponent(
          String(newLockUntil)
        )}; Path=/; Max-Age=${LOCK_MS / 1000}; SameSite=Lax`
      );

      return res;
    }

    return NextResponse.json({ output: text, locked: false });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
