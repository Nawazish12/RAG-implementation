"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useState } from "react";

type DocumentRow = {
  id: string;
  title: string;
  filename: string | null;
  mime_type: string | null;
  byte_size: number | null;
  created_at: string;
  chunk_count: number;
};

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        "text" in part &&
        part.type === "text" &&
        typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}



export function PracticeConsole() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setInput } = useChat({
    api: "/api/chat",
  });

  const refreshDocuments = useCallback(async () => {
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const res = await fetch("/api/documents");
      const json = (await res.json()) as { documents?: DocumentRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load documents");
      setDocuments(json.documents ?? []);
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  async function onUpload(formData: FormData) {
    setUploadBusy(true);
    setUploadMessage(null);
    try {
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const json = (await res.json()) as { error?: string; documentId?: string; chunkCount?: number };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setUploadMessage(`Ingested ${json.chunkCount ?? 0} chunks.`);
      setUploadTitle("");
      await refreshDocuments();
    } catch (e) {
      setUploadMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this document and all of its chunks?")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      alert(json.error ?? "Delete failed");
      return;
    }
    await refreshDocuments();
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">RAG practice lab</h1>
        <p className="max-w-3xl text-sm text-[var(--muted)]">
          Upload documents, store their chunks in Supabase + pgvector, and chat with grounded answers.
          No authentication; keep your service role key server-side only.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section
          className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm"
          style={{ boxShadow: "0 0 0 1px color-mix(in oklab, var(--border) 55%, transparent)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Knowledge base</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Upload PDF, Markdown, or plain text.</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshDocuments()}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-white/5"
            >
              Refresh
            </button>
          </div>

          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if (uploadTitle.trim()) fd.set("title", uploadTitle.trim());
              void onUpload(fd);
            }}
          >
            <div className="grid gap-2">
              <label className="text-sm text-[var(--muted)]" htmlFor="title">
                Title (optional)
              </label>
              <input
                id="title"
                name="title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Defaults to the filename"
                className="w-full rounded-md border border-[var(--border)] bg-black/20 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-[var(--muted)]" htmlFor="file">
                File
              </label>
              <input
                id="file"
                name="file"
                type="file"
                required
                accept=".pdf,.txt,.md,.markdown,.json,application/pdf,text/plain,text/markdown"
                className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-black/20 file:px-3 file:py-2 file:text-sm file:text-[var(--text)] hover:file:bg-white/5"
              />
            </div>

            <button
              type="submit"
              disabled={uploadBusy}
              className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
            >
              {uploadBusy ? "Ingesting…" : "Ingest document"}
            </button>
            {uploadMessage ? <p className="text-sm text-[var(--muted)]">{uploadMessage}</p> : null}
          </form>

          <div className="mt-6 border-t border-[var(--border)] pt-5">
            <h3 className="text-sm font-medium">Documents</h3>
            {loadingDocs ? (
              <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
            ) : docsError ? (
              <p className="mt-3 text-sm text-[var(--danger)]">{docsError}</p>
            ) : documents.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">No documents yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-black/15 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {d.chunk_count} chunks · {d.filename ?? "upload"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onDelete(d.id)}
                      className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--danger)] hover:bg-white/5"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="text-lg font-medium">RAG chat</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Each reply retrieves fresh chunks from your uploaded documents before answering.
          </p>

          <div className="mt-4 h-[620px] overflow-y-auto rounded-lg border border-[var(--border)] bg-black/20 p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Ask something about your ingested documents.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <div className="text-xs font-semibold text-[var(--muted)]">{m.role}</div>
                    <div className="mt-1 whitespace-pre-wrap leading-relaxed">{messageText(m.content)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error.message}</p> : null}

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(e);
            }}
          >
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask a grounded question…"
              className="flex-1 rounded-md border border-[var(--border)] bg-black/20 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-md bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => {
                setInput("");
              }}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-white/5"
            >
              Clear input
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
