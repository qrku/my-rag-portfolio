import { isAuthenticated } from "@/lib/admin-auth";
import {
  LANGS,
  type Lang,
  hashContent,
  indexDocument,
  removeIndexedDocument,
} from "@/lib/rag";
import { getSupabase } from "@/lib/supabase";

const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,80}\.md$/i;
const MAX_CONTENT = 100_000;

type Status = "indexed" | "stale" | "not_indexed" | "index_only";

type ListedDocument = {
  lang: string;
  name: string;
  content: string | null;
  updated_at: string | null;
  indexed_at: string | null;
  chunks: number;
  status: Status;
};

function parseTarget(body: unknown) {
  const b = body as Record<string, unknown> | null;
  const lang = LANGS.find((l) => l === b?.lang) as Lang | undefined;
  const name = typeof b?.name === "string" ? b.name : "";
  if (!lang || !NAME_RE.test(name)) return null;
  return {
    lang,
    name,
    content: typeof b?.content === "string" ? b.content : "",
    index: b?.index === true,
    action: typeof b?.action === "string" ? b.action : "",
  };
}

const unauthorized = () =>
  Response.json({ error: "Unauthorized" }, { status: 401 });
const fail = (message: string, status = 500) =>
  Response.json({ error: message }, { status });

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  const supabase = getSupabase();

  const [files, counts] = await Promise.all([
    supabase
      .from("source_documents")
      .select("lang, name, content, updated_at, indexed_hash, indexed_at"),
    supabase.rpc("document_chunk_counts"),
  ]);
  if (files.error) return fail(files.error.message);
  if (counts.error) return fail(counts.error.message);

  const chunkMap = new Map<string, number>();
  for (const c of counts.data as { lang: string; source: string; chunks: number }[]) {
    chunkMap.set(`${c.lang}/${c.source}`, Number(c.chunks));
  }

  const seen = new Set<string>();
  const documents = files.data.map((f): ListedDocument => {
    const key = `${f.lang}/${f.name}`;
    seen.add(key);
    const chunks = chunkMap.get(key) ?? 0;
    let status: Status = "not_indexed";
    if (chunks > 0) {
      status = f.indexed_hash === hashContent(f.content) ? "indexed" : "stale";
    }
    return {
      lang: f.lang,
      name: f.name,
      content: f.content as string | null,
      updated_at: f.updated_at,
      indexed_at: f.indexed_at,
      chunks,
      status,
    };
  });

  for (const [key, chunks] of chunkMap) {
    if (seen.has(key)) continue;
    const [lang, ...rest] = key.split("/");
    documents.push({
      lang,
      name: rest.join("/"),
      content: null,
      updated_at: null,
      indexed_at: null,
      chunks,
      status: "index_only",
    });
  }

  documents.sort((a, b) =>
    a.lang === b.lang ? a.name.localeCompare(b.name) : a.lang.localeCompare(b.lang),
  );
  return Response.json({ documents });
}

export async function PUT(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();

  const t = parseTarget(await req.json().catch(() => null));
  if (!t || !t.content.trim() || t.content.length > MAX_CONTENT) {
    return fail("Invalid document", 400);
  }

  const { error } = await getSupabase().from("source_documents").upsert({
    lang: t.lang,
    name: t.name,
    content: t.content,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail(error.message);

  if (!t.index) return Response.json({ ok: true, indexed: false });

  try {
    const chunks = await indexDocument(t.lang, t.name, t.content);
    return Response.json({ ok: true, indexed: true, chunks });
  } catch (e) {
    console.error(e);
    return fail("Saved, but indexing failed. Try indexing again.", 502);
  }
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();

  const t = parseTarget(await req.json().catch(() => null));
  if (!t) return fail("Invalid document", 400);

  try {
    if (t.action === "unindex") {
      await removeIndexedDocument(t.lang, t.name);
      return Response.json({ ok: true });
    }

    if (t.action === "index") {
      const { data, error } = await getSupabase()
        .from("source_documents")
        .select("content")
        .eq("lang", t.lang)
        .eq("name", t.name)
        .maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("File not found", 404);
      const chunks = await indexDocument(t.lang, t.name, data.content);
      return Response.json({ ok: true, chunks });
    }
  } catch (e) {
    console.error(e);
    return fail("Operation failed", 502);
  }

  return fail("Unknown action", 400);
}

export async function DELETE(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();

  const t = parseTarget(await req.json().catch(() => null));
  if (!t) return fail("Invalid document", 400);

  const { error } = await getSupabase()
    .from("source_documents")
    .delete()
    .eq("lang", t.lang)
    .eq("name", t.name);
  if (error) return fail(error.message);

  try {
    await removeIndexedDocument(t.lang, t.name);
  } catch (e) {
    console.error(e);
    return fail("File deleted, but removing the index failed", 502);
  }
  return Response.json({ ok: true });
}
