"use client";

import { FormEvent, useMemo, useState } from "react";

type MessageRole = "user" | "assistant";

type Message = {
  id: string;
  role: MessageRole;
  content: string;
};

const starterPrompts = [
  "Explain React state management simply",
  "Help me write a clean API in Node.js",
  "Give me a study plan for software engineering",
  "Write a professional email template",
];

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I’m your AI assistant. Ask me anything — coding help, explanations, writing, ideas, or general questions.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((msg) => msg.role === "user"),
    [messages]
  );

  const sendMessage = async (messageText?: string) => {
    const text = (messageText ?? input).trim();

    if (!text || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to get a response.");
      }

      const assistantReply = data.reply || "I’m here to help. Can you rephrase that?";

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantReply,
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, something went wrong on my side. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await sendMessage();
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-slate-950/30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">AI Assistant</p>
            <h1 className="mt-1 text-2xl font-bold text-white">IntelliBot AI</h1>
          </div>
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            {isLoading ? "Thinking..." : "Ready"}
          </div>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => sendMessage(prompt)}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-white"
          >
            {prompt}
          </button>
        ))}
      </div>

      <section className="flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-slate-950/40">
        <div className="h-[65vh] space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-7 shadow-lg sm:text-base ${
                  message.role === "user"
                    ? "bg-cyan-600 text-white"
                    : "border border-slate-700 bg-slate-800 text-slate-100"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400"></span>
                  Thinking...
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-3 shadow-lg shadow-slate-950/30">
        <div className="flex flex-col gap-3 sm:flex-row">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            rows={3}
            placeholder="Ask anything..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isLoading ? "Sending..." : "Send"}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>Press Enter to send, Shift + Enter for a new line</span>
          <span>{lastUserMessage ? `Last prompt: ${lastUserMessage.content.slice(0, 30)}${lastUserMessage.content.length > 30 ? "..." : ""}` : "No prompt yet"}</span>
        </div>
      </form>
    </div>
  );
}
