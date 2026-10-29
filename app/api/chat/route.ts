import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

type ChatRole = "user" | "assistant" | "system";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

function demoReply(prompt: string): string {
  const cleaned = prompt.trim();

  if (!cleaned) {
    return "Ask me anything and I’ll help you with it.";
  }

  const lower = cleaned.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi")) {
    return "Hello! I’m your AI assistant. Ask me about coding, study help, writing, ideas, or anything you need explained.";
  }

  if (lower.includes("code") || lower.includes("javascript") || lower.includes("typescript") || lower.includes("python")) {
    return "I can help with that. Share the exact issue, the error message, or the code snippet, and I’ll guide you through a fix or explain the logic step by step.";
  }

  if (lower.includes("write") || lower.includes("essay") || lower.includes("email") || lower.includes("resume") || lower.includes("cover letter")) {
    return "Absolutely. Tell me the purpose, audience, tone, and key points, and I can draft a polished version for you.";
  }

  if (lower.includes("math") || lower.includes("calculate") || lower.includes("equation")) {
    return "I can help solve it. Send the equation, values, or problem statement, and I’ll work it out clearly with steps.";
  }

  return `I’m currently running in demo mode, but I can still help with a quick answer. For the best results, send the full question, the context, and any code or error details you have. For example: “Explain this error,” “Write a function,” or “Summarize this topic.”`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const incomingMessages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];

    const messages = incomingMessages
      .filter((message) => typeof message?.content === "string" && message.content.trim().length > 0)
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : message.role === "system" ? "system" : "user",
        content: String(message.content).trim(),
      }));

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No message content provided." },
        { status: 400 }
      );
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      const lastPrompt = messages[messages.length - 1]?.content ?? "help me";
      return NextResponse.json({
        reply: demoReply(lastPrompt),
        mode: "demo",
      });
    }

    const modelName = process.env.AI_MODEL_NAME || "gemini-1.5-flash";
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: `You are a helpful AI assistant. Provide clear, accurate, and practical answers. Be concise but complete. If the user asks for code, explain it with examples and best practices. If the user asks for general information, answer directly with useful context. If needed, ask clarifying questions before making assumptions.`,
    });

    const contents = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

    const result = await model.generateContent({ contents });
    const response = await result.response;
    const reply = response.text();

    return NextResponse.json({
      reply,
      mode: "gemini",
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      {
        reply: "I hit a temporary issue while generating a response. Please try again in a moment.",
        mode: "error",
      },
      { status: 500 }
    );
  }
}
