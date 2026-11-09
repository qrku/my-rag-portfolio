import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  embed,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { chatModel, embeddingModel } from "@/lib/ai";
import { getSupabase } from "@/lib/supabase";

const MAX_QUESTION_CHARS = 500;
const MAX_HISTORY = 10;

const SYSTEM_PROMPTS = {
  ru: `Ты ассистент на портфолио-сайте. Отвечай на вопросы о владельце сайта, его опыте, проектах и навыках, только на основе предоставленного контекста. Если в контексте нет ответа, честно скажи, что не знаешь, и предложи связаться с владельцем напрямую. Не выдумывай факты. Отвечай по-русски, кратко и по делу.`,
  en: `You are an assistant on a portfolio website. Answer questions about the site owner, their experience, projects and skills using only the provided context. If the context does not contain the answer, say you don't know and suggest contacting the owner directly. Do not invent facts. Answer in English, briefly and to the point.`,
} as const;

function textOf(message: UIMessage) {
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
}

export async function POST(req: Request) {
  const body = await req.json();
  const lang: "ru" | "en" = body.lang === "en" ? "en" : "ru";
  const messages: UIMessage[] = Array.isArray(body.messages)
    ? body.messages.slice(-MAX_HISTORY)
    : [];

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const question = lastUser ? textOf(lastUser) : "";

  if (!question || question.length > MAX_QUESTION_CHARS) {
    return new Response("Invalid question", { status: 400 });
  }

  const { embedding } = await embed({ model: embeddingModel, value: question });

  const { data, error } = await getSupabase().rpc("match_documents", {
    query_embedding: JSON.stringify(embedding),
    match_lang: lang,
    match_count: 5,
  });
  if (error) {
    console.error(error);
    return new Response("Search failed", { status: 500 });
  }

  const context = (data as { source: string; content: string }[])
    .map((d) => `[${d.source}]\n${d.content}`)
    .join("\n\n---\n\n");

  const result = streamText({
    model: chatModel,
    system: `${SYSTEM_PROMPTS[lang]}\n\nContext:\n${context}`,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 600,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
