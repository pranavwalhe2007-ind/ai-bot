import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

type ChatMode = "general" | "coding" | "creative" | "research";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const systemByMode: Record<ChatMode, string> = {
  general:
    "You are a helpful, thoughtful AI assistant. Be clear, practical, and warm. Give direct answers, explain complex ideas simply, and ask clarifying questions only when important.",
  coding:
    "You are an elite software engineer. Answer with secure, maintainable, production-minded guidance. Explain trade-offs, edge cases, code patterns, and debugging steps clearly and accurately.",
  creative:
    "You are a creative strategist and writer. Help brainstorm ideas, reshape tone, structure compelling arguments, and generate polished, vivid content that feels premium and intentional.",
  research:
    "You are a research and analysis assistant. Synthesize information clearly, compare options, highlight assumptions, and present practical conclusions with nuance and structure.",
};

function fallbackReply(mode: ChatMode, prompt: string): string {
  const value = prompt.trim();
  if (!value) return "Ask me anything and I’ll help you.";

  const lower = value.toLowerCase();

  if (mode === "coding") {
    return `Start by identifying the actual input, expected output, and failure case. Then I can help you design the fix or refactor. Share the code, error message, and stack trace if you want a precise answer.`;
  }

  if (mode === "creative") {
    return `A strong creative answer begins with audience, purpose, tone, and message. Tell me the target audience and goal, and I’ll help you shape a better version with more clarity and impact.`;
  }

  if (mode === "research") {
    return `Break the topic into: what is known, what is uncertain, what trade-offs exist, and what likely conclusion fits the evidence. Share the source or context and I’ll synthesize a cleaner answer.`;
  }

  if (lower.includes("hello") || lower.includes("hi")) {
    return "Hello! I’m ready to help with coding, brainstorming, writing, study questions, and everyday problem-solving.";
  }

  if (lower.includes("code") || lower.includes("javascript") || lower.includes("typescript") || lower.includes("python")) {
    return "I can help with that. Share the exact code, issue, or error and I’ll give you a clear, practical fix.";
  }

  if (lower.includes("write") || lower.includes("essay") || lower.includes("email") || lower.includes("resume")) {
    return "Absolutely. Tell me the audience, purpose, and desired tone, and I’ll draft something polished and effective for you.";
  }

  return `I can help with that. Give me the context and the goal, and I’ll turn it into a clear, useful answer with the right level of detail.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode: ChatMode =
      typeof body?.mode === "string" && body.mode in systemByMode
        ? (body.mode as ChatMode)
        : "general";

    const incomingMessages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
    const messages = incomingMessages
      .filter((message) => typeof message?.content === "string" && message.content.trim().length > 0)
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: String(message.content).trim(),
      }))
      .slice(-20);

    if (messages.length === 0) {
      return NextResponse.json({ error: "No message content provided." }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      const lastPrompt = messages[messages.length - 1]?.content ?? "help me";
      return NextResponse.json({
        reply: fallbackReply(mode, lastPrompt),
        mode,
      });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const modelName = process.env.AI_MODEL_NAME || "gemini-1.5-flash";
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemByMode[mode],
    });

    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

    const result = await model.generateContentStream({ contents });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (error) {
          console.error("Streaming chat error:", error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        reply: "I hit a temporary issue. Please try again in a moment.",
        mode: "general",
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
