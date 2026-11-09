"use client";

import { useCallback, useEffect, useState } from "react";

type Lang = "ru" | "en";
type Status = "indexed" | "stale" | "not_indexed" | "index_only";
type Doc = {
  lang: Lang;
  name: string;
  content: string | null;
  updated_at: string | null;
  indexed_at: string | null;
  chunks: number;
  status: Status;
};

const STATUS: Record<Status, { label: string; className: string }> = {
  indexed: { label: "indexed", className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  stale: { label: "outdated index", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  not_indexed: { label: "not indexed", className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  index_only: { label: "index only (no file)", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,80}\.md$/i;

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [lang, setLang] = useState<Lang>("ru");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api("GET", "/api/admin/documents");
    if (r.status === 401) return setAuthed(false);
    setAuthed(true);
    setDocs(r.data.documents ?? []);
  }, []);

  useEffect(() => {
    api("GET", "/api/admin/documents").then((r) => {
      if (r.status === 401) return setAuthed(false);
      setAuthed(true);
      setDocs(r.data.documents ?? []);
    });
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const r = await api("POST", "/api/admin/login", { password });
    setPassword("");
    if (!r.ok) return setMessage(r.data.error ?? "Login failed");
    setMessage(null);
    await load();
  }

  async function logout() {
    await api("POST", "/api/admin/logout");
    setAuthed(false);
    setDocs([]);
  }

  async function run<T>(label: string, fn: () => Promise<T>) {
    setBusy(true);
    setMessage(label);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const current = docs.find((d) => d.lang === lang && d.name === name);
  const hasFile = current?.content != null;
  const dirty = !current || current.content !== content;

  const act = (label: string, method: string, body: object, done: (d: { indexed?: boolean; chunks?: number }) => string) =>
    run(label, async () => {
      const r = await api(method, "/api/admin/documents", body);
      setMessage(r.ok ? done(r.data) : (r.data.error ?? "Failed"));
      await load();
    });

  const save = (index: boolean) =>
    act(index ? "Saving and indexing..." : "Saving...", "PUT", { lang, name, content, index }, (d) =>
      d.indexed ? `Saved. Indexed ${d.chunks} chunks.` : "Saved (not indexed).",
    );

  const indexSaved = () =>
    act("Indexing...", "POST", { lang, name, action: "index" }, (d) => `Indexed ${d.chunks} chunks.`);

  const unindex = () => {
    if (!confirm(`Remove index for ${lang}/${name}? The file stays.`)) return;
    return act("Removing index...", "POST", { lang, name, action: "unindex" }, () => "Index removed. File kept.");
  };

  const remove = () => {
    if (!confirm(`Delete ${lang}/${name} and its index?`)) return;
    return act("Deleting...", "DELETE", { lang, name }, () => "File and index deleted.").then(newDoc);
  };

  const reindex = () =>
    run("Reindexing everything...", async () => {
      const r = await api("POST", "/api/admin/reindex");
      setMessage(
        r.ok
          ? `Reindexed ${r.data.documents} documents, ${r.data.chunks} chunks.`
          : (r.data.error ?? "Failed"),
      );
      await load();
    });

  function newDoc() {
    setName("");
    setContent("");
  }

  function open(d: Doc) {
    setLang(d.lang);
    setName(d.name);
    setContent(d.content ?? "");
    setMessage(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setName(file.name);
    setContent(await file.text());
  }

  if (authed === null) return <main className="p-6 text-sm">Loading...</main>;

  if (!authed) {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="mb-4 text-lg font-semibold">Admin</h1>
        <form onSubmit={login} className="flex flex-col gap-2">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button className="rounded bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">
            Sign in
          </button>
          {message && <p className="text-sm text-red-600">{message}</p>}
        </form>
      </main>
    );
  }

  const canSave = !busy && NAME_RE.test(name) && content.trim().length > 0;
  const orphan = current?.status === "index_only";

  return (
    <main className="mx-auto grid max-w-5xl gap-4 p-6 md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Documents</h1>
          <button onClick={logout} className="text-xs underline">
            Sign out
          </button>
        </div>
        <button
          onClick={newDoc}
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
        >
          + New document
        </button>
        <ul className="flex flex-col gap-1 text-sm">
          {docs.map((d) => (
            <li key={`${d.lang}/${d.name}`}>
              <button
                onClick={() => open(d)}
                className={`w-full rounded px-2 py-1 text-left ${
                  d.lang === lang && d.name === name
                    ? "bg-zinc-200 dark:bg-zinc-800"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase text-zinc-500">{d.lang}</span>
                  <span className="min-w-0 flex-1 truncate">{d.name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs">
                  <span className={`rounded px-1.5 py-0.5 ${STATUS[d.status].className}`}>
                    {STATUS[d.status].label}
                  </span>
                  <span className="text-zinc-500">{d.chunks} chunks</span>
                </div>
              </button>
            </li>
          ))}
          {docs.length === 0 && <li className="text-zinc-500">No documents yet.</li>}
        </ul>
        <button
          onClick={reindex}
          disabled={busy || docs.length === 0}
          className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Reindex all
        </button>
      </aside>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="rounded border border-zinc-300 bg-transparent px-2 py-2 text-sm dark:border-zinc-700"
          >
            <option value="ru">ru</option>
            <option value="en">en</option>
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="file-name.md"
            className="min-w-0 flex-1 rounded border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <label className="cursor-pointer rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
            Upload .md
            <input type="file" accept=".md,text/markdown" onChange={onFile} hidden />
          </label>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="# Markdown..."
          className="h-[60vh] rounded border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700"
        />
        {orphan && (
          <p className="text-sm text-red-600">
            This index has no source file (it was indexed before files were stored). You can remove
            the index, or paste the content above and save it as a file.
          </p>
        )}
        {current && !orphan && (
          <p className="text-xs text-zinc-500">
            {current.chunks} chunks in index
            {current.indexed_at && ` · indexed ${new Date(current.indexed_at).toLocaleString()}`}
            {dirty && " · unsaved changes"}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => save(false)}
            disabled={!canSave || (hasFile && !dirty)}
            className="rounded border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            Save
          </button>
          <button
            onClick={() => save(true)}
            disabled={!canSave}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Save &amp; index
          </button>
          {hasFile && !dirty && current.status !== "indexed" && (
            <button
              onClick={indexSaved}
              disabled={busy}
              className="rounded border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              {current.chunks > 0 ? "Reindex" : "Index"}
            </button>
          )}
          {current && current.chunks > 0 && (
            <button
              onClick={unindex}
              disabled={busy}
              className="rounded border border-amber-500 px-4 py-2 text-sm text-amber-700 disabled:opacity-50 dark:text-amber-400"
            >
              Remove index
            </button>
          )}
          {current && (
            <button
              onClick={remove}
              disabled={busy}
              className="rounded border border-red-400 px-4 py-2 text-sm text-red-600 disabled:opacity-50"
            >
              {hasFile ? "Delete file + index" : "Delete index"}
            </button>
          )}
        </div>
        {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
      </section>
    </main>
  );
}
