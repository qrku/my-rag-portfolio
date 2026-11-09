import { setDefaultAutoSelectFamily } from "node:net";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { LANGS, indexDocument } from "../src/lib/rag";
import { getSupabase } from "../src/lib/supabase";

setDefaultAutoSelectFamily(false);

const CONTENT_DIR = path.join(process.cwd(), "content");

async function main() {
  const supabase = getSupabase();

  for (const lang of LANGS) {
    const dir = path.join(CONTENT_DIR, lang);
    const files = (await readdir(dir).catch(() => [])).filter((f) =>
      f.endsWith(".md"),
    );

    let chunks = 0;
    for (const file of files) {
      const text = await readFile(path.join(dir, file), "utf8");
      const { error } = await supabase.from("source_documents").upsert({
        lang,
        name: file,
        content: text,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      chunks += await indexDocument(lang, file, text);
    }

    console.log(`[${lang}] imported ${files.length} files, ${chunks} chunks`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
