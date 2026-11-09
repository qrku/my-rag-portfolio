import { createHash } from "node:crypto";
import { embedMany } from "ai";
import { embeddingModel } from "./ai";
import { getSupabase } from "./supabase";

export const LANGS = ["ru", "en"] as const;
export type Lang = (typeof LANGS)[number];

const MAX_CHUNK_CHARS = 1000;

export function hashContent(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export function chunkMarkdown(text: string): string[] {
  const sections = text
    .split(/\n(?=#{1,3} )/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const section of sections) {
    if (section.length <= MAX_CHUNK_CHARS) {
      chunks.push(section);
      continue;
    }
    let current = "";
    for (const paragraph of section.split(/\n{2,}/)) {
      if (current && current.length + paragraph.length > MAX_CHUNK_CHARS) {
        chunks.push(current.trim());
        current = "";
      }
      current += paragraph + "\n\n";
    }
    if (current.trim()) chunks.push(current.trim());
  }
  return chunks;
}

export async function indexDocument(lang: Lang, source: string, text: string) {
  const supabase = getSupabase();
  const chunks = chunkMarkdown(text);

  const { embeddings } = chunks.length
    ? await embedMany({ model: embeddingModel, values: chunks })
    : { embeddings: [] };

  const { error: delError } = await supabase
    .from("documents")
    .delete()
    .eq("lang", lang)
    .eq("source", source);
  if (delError) throw delError;

  if (chunks.length) {
    const { error } = await supabase.from("documents").insert(
      chunks.map((content, chunk_index) => ({
        lang,
        source,
        chunk_index,
        content,
        embedding: JSON.stringify(embeddings[chunk_index]),
      })),
    );
    if (error) throw error;
  }

  const { error: stampError } = await supabase
    .from("source_documents")
    .update({ indexed_hash: hashContent(text), indexed_at: new Date().toISOString() })
    .eq("lang", lang)
    .eq("name", source);
  if (stampError) throw stampError;

  return chunks.length;
}

export async function removeIndexedDocument(lang: Lang, source: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("lang", lang)
    .eq("source", source);
  if (error) throw error;

  const { error: stampError } = await supabase
    .from("source_documents")
    .update({ indexed_hash: null, indexed_at: null })
    .eq("lang", lang)
    .eq("name", source);
  if (stampError) throw stampError;
}
