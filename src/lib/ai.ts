import { createOpenAI } from "@ai-sdk/openai";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  name: "openrouter",
});

export const EMBEDDING_DIMENSIONS = 1536;

export const embeddingModel = openrouter.embeddingModel(
  process.env.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
);

export const chatModel = openrouter.chat(
  process.env.OPENROUTER_CHAT_MODEL ?? "openai/gpt-4o-mini",
);
