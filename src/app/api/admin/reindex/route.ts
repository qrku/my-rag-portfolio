import { isAuthenticated } from "@/lib/admin-auth";
import { type Lang, indexDocument } from "@/lib/rag";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 60;

export async function POST() {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await getSupabase()
    .from("source_documents")
    .select("lang, name, content");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let chunks = 0;
  try {
    for (const d of data) {
      chunks += await indexDocument(d.lang as Lang, d.name, d.content);
    }
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Indexing failed" }, { status: 502 });
  }
  return Response.json({ ok: true, documents: data.length, chunks });
}
