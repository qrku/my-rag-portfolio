"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

type Lang = "ru" | "en";

const UI = {
  ru: {
    title: "Спроси про моё резюме",
    placeholder: "Например: что ты делал в Origins Marketplace?",
    send: "Отправить",
    thinking: "Думаю...",
    error: "Что-то пошло не так. Попробуй ещё раз.",
    empty: "Задай вопрос про мой опыт, проекты или навыки.",
  },
  en: {
    title: "Ask about my resume",
    placeholder: "E.g. What did you do at Origins Marketplace?",
    send: "Send",
    thinking: "Thinking...",
    error: "Something went wrong. Please try again.",
    empty: "Ask a question about my experience, projects or skills.",
  },
} as const;

export default function Home() {
  const [lang, setLang] = useState<Lang>("ru");

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, setMessages } = useChat();

  const t = UI[lang];
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4 py-6">
      <header className="flex items-center justify-between pb-4">
        <h1 className="text-lg font-semibold">{t.title}</h1>
        <div className="flex gap-1 text-sm">
          {(["ru", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLang(l);
                setMessages([]);
              }}
              className={`rounded px-2 py-1 uppercase ${
                lang === l
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto rounded border border-zinc-200 p-3 dark:border-zinc-800">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">{t.empty}</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-10 bg-zinc-100 dark:bg-zinc-800"
                : "mr-10 bg-blue-50 dark:bg-blue-950"
            }`}
          >
            {m.parts.map((p, i) =>
              p.type === "text" ? <span key={i}>{p.text}</span> : null,
            )}
          </div>
        ))}
        {status === "submitted" && (
          <p className="text-sm text-zinc-500">{t.thinking}</p>
        )}
        {error && <p className="text-sm text-red-600">{t.error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text || busy) return;
          sendMessage({ text }, { body: { lang } });
          setInput("");
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder={t.placeholder}
          className="flex-1 rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {t.send}
        </button>
      </form>
    </main>
  );
}
