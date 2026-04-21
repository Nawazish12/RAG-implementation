import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { embedQuery } from "@/lib/embeddings";

export type RetrievedChunk = {
  id: number;
  documentId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  documentTitle: string | null;
};

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function retrieveChunks(
  query: string,
  matchCount = 8,
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(query);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: toVectorLiteral(embedding),
    match_count: matchCount,
  });

  if (error) throw new Error(`Vector search failed: ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: number;
    document_id: string;
    chunk_index: number;
    content: string;
    similarity: number;
  }>;

  if (rows.length === 0) return [];

  const docIds = [...new Set(rows.map((r) => r.document_id))];
  const { data: docs, error: docErr } = await supabase
    .from("documents")
    .select("id, title")
    .in("id", docIds);

  if (docErr) throw new Error(`Failed to load document titles: ${docErr.message}`);

  const titleById = new Map((docs ?? []).map((d) => [d.id as string, d.title as string]));

  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    chunkIndex: r.chunk_index,
    content: r.content,
    similarity: r.similarity,
    documentTitle: titleById.get(r.document_id) ?? null,
  }));
}

export function formatContextForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant passages were retrieved from the knowledge base.";
  }

  return chunks
    .map((c, i) => {
      const title = c.documentTitle ?? "Unknown document";
      return `### Source ${i + 1} (document: ${title}, chunk #${c.chunkIndex})\n${c.content}`;
    })
    .join("\n\n");
}
