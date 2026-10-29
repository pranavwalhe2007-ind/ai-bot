"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, LoaderCircle, MessageSquarePlus, SendHorizonal, Sparkles, Trash2 } from "lucide-react";
import MarkdownContent from "@/components/markdown-content";

type MessageRole = "user" | "assistant";

type Message = {
  id: string;
  role: MessageRole;
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
};

const STORAGE_KEY = "intellibot-chat-history";
const defaultWelcomeMessage =
  "Hi! I’m your AI assistant. Ask me anything — coding help, study support, writing, brainstorming, or general questions.";

const starterPrompts = [
  "Explain React state management simply",
  "Help me write a clean API in Node.js",
  "Give me a study plan for software engineering",
  "Write a professional email template",
  "Summarize the difference between AI, ML, and deep learning",
];

function createMessage(role: MessageRole, content: string): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
  };
}

function makeConversationTitle(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";

  const words = cleaned.split(" ").slice(0, 5);
  const title = words.join(" ");
  return title.length > 28 ? `${title.slice(0, 25)}...` : title;
}

function buildInitialConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [createMessage("assistant", defaultWelcomeMessage)],
  };
}

export default function ChatApp() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        const initial = buildInitialConversation();
        setConversations([initial]);
        setActiveConversationId(initial.id);
        return;
      }

      const parsed: Conversation[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setConversations(parsed);
        setActiveConversationId(parsed[0].id);
        return;
      }
    } catch {
      // fall back to default
    }

    const fallback = buildInitialConversation();
    setConversations([fallback]);
    setActiveConversationId(fallback.id);
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  }, [conversations]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const createNewChat = () => {
    const conversation = buildInitialConversation();
    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(conversation.id);
    setInput("");
  };

  const deleteConversation = (conversationId: string) => {
    setConversations((prev) => {
      const next = prev.filter((conversation) => conversation.id !== conversationId);
      if (next.length === 0) {
        const replacement = buildInitialConversation();
        setActiveConversationId(replacement.id);
        return [replacement];
      }

      if (activeConversationId === conversationId) {
        setActiveConversationId(next[0].id);
      }

      return next;
    });
  };

  const updateConversation = (updated: Conversation) => {
    setConversations((prev) => {
      const exists = prev.some((conversation) => conversation.id === updated.id);
      if (!exists) {
        return [updated, ...prev];
      }

      return prev.map((conversation) =>
        conversation.id === updated.id ? updated : conversation
      );
    });
  };

  const sendMessage = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || isLoading) return;

    let conversation = activeConversation;

    if (!conversation) {
      conversation = buildInitialConversation();
      setConversations((prev) => [conversation!, ...prev]);
      setActiveConversationId(conversation.id);
    }

    const userMessage = createMessage("user", text);
    const nextMessages = [...conversation.messages, userMessage];

    const nextTitle =
      conversation.title === "New chat" ? makeConversationTitle(text) : conversation.title;

    const updatedConversation: Conversation = {
      ...conversation,
      title: nextTitle,
      messages: nextMessages,
    };

    updateConversation(updatedConversation);
    setInput("");
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    const streamingConversation: Conversation = {
      ...updatedConversation,
      messages: [...nextMessages, createMessage("assistant", "")],
    };

    updateConversation(streamingConversation);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || "Unable to get a response.");
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();
        const finalReply = data.reply || "I’m here to help. Can you rephrase that?";

        const finalized = {
          ...streamingConversation,
          messages: [...nextMessages, createMessage("assistant", finalReply)],
        };
        updateConversation(finalized);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming response is unavailable.");

      const decoder = new TextDecoder();
      let streamedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamedText += decoder.decode(value, { stream: true });

        setConversations((prev) =>
          prev.map((conversationItem) =>
            conversationItem.id === streamingConversation.id
              ? {
                  ...conversationItem,
                  messages: conversationItem.messages.map((message) =>
                    message.id === assistantId
                      ? { ...message, content: streamedText }
                      : message
                  ),
                }
              : conversationItem
          )
        );
      }

      streamedText += decoder.decode();
      setConversations((prev) =>
        prev.map((conversationItem) =>
          conversationItem.id === streamingConversation.id
            ? {
                ...conversationItem,
                messages: conversationItem.messages.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: streamedText.trim() || "I’m here to help. Can you rephrase that?" }
                    : message
                ),
              }
            : conversationItem
        )
      );
    } catch (error) {
      console.error(error);
      setConversations((prev) =>
        prev.map((conversationItem) =>
          conversationItem.id === streamingConversation.id
            ? {
                ...conversationItem,
                messages: [
                  ...conversationItem.messages.slice(0, -1),
                  createMessage(
                    "assistant",
                    "Sorry, something went wrong on my side. Please try again."
                  ),
                ],
              }
            : conversationItem
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await sendMessage();
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <aside className="hidden w-80 shrink-0 rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-slate-950/30 lg:flex lg:flex-col">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/15 p-2 text-cyan-300">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Workspace</p>
              <h2 className="text-lg font-semibold text-white">IntelliBot AI</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={createNewChat}
            className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-200 transition hover:border-cyan-400 hover:text-white"
            aria-label="New chat"
          >
            <MessageSquarePlus size={18} />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          <Sparkles size={16} className="text-cyan-400" />
          Smart assistant
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`group flex cursor-pointer items-center justify-between gap-2 rounded-2xl border px-3 py-2 transition ${
                activeConversationId === conversation.id
                  ? "border-cyan-500/50 bg-slate-800 text-white"
                  : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-600"
              }`}
              onClick={() => setActiveConversationId(conversation.id)}
            >
              <span className="truncate text-sm font-medium">{conversation.title}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteConversation(conversation.id);
                }}
                className="rounded-lg p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-700 hover:text-white"
                aria-label="Delete conversation"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex min-h-[80vh] flex-1 flex-col rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">AI Chat</p>
            <h1 className="mt-1 text-xl font-semibold text-white">
              {activeConversation?.title || "New chat"}
            </h1>
          </div>
          <button
            type="button"
            onClick={createNewChat}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-500 hover:text-white"
          >
            New chat
          </button>
        </header>

        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-800 px-4 py-3 sm:px-5">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(prompt)}
              className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 transition hover:border-cyan-400 hover:text-white sm:text-sm"
            >
              {prompt}
            </button>
          ))}
        </div>

        <section className="flex-1 overflow-hidden">
          <div className="h-[62vh] space-y-4 overflow-y-auto p-4 sm:p-6">
            {activeConversation?.messages.map((message) => (
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
                  {message.role === "assistant" && message.content ? (
                    <MarkdownContent content={message.content} />
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin text-cyan-400" />
                    Thinking...
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="border-t border-slate-800 bg-slate-950/70 p-4 sm:p-5">
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
              className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              <SendHorizonal size={18} />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
