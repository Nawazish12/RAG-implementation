import { chunkText } from "@/lib/chunk";
import { embedMany } from "@/lib/embeddings";
import { extractTextFromFile } from "@/lib/extract-text";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const INSERT_BATCH_SIZE = 25;
const MAX_INSERT_RETRIES = 3;

export type IngestResult = {
  documentId: string;
  title: string;
  chunkCount: number;
};

export async function ingestFile(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  title?: string;
}): Promise<IngestResult> {
  const title = params.title?.trim() || params.filename;
  const text = await extractTextFromFile(params.buffer, params.mimeType);
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    throw new Error("No text could be extracted from this file.");
  }

  const embeddings = await embedMany(chunks);
  const supabase = getSupabaseAdmin();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      title,
      filename: params.filename,
      mime_type: params.mimeType,
      byte_size: params.buffer.byteLength,
    })
    .select("id")
    .single();

  if (docErr || !doc?.id) {
    throw new Error(`Failed to create document: ${docErr?.message ?? "unknown error"}`);
  }

  const documentId = doc.id as string;

  const insertRows = chunks.map((content, chunkIndex) => ({
    document_id: documentId,
    chunk_index: chunkIndex,
    content,
    embedding: `[${(embeddings[chunkIndex] ?? []).join(",")}]`,
  }));

  try {
    for (let i = 0; i < insertRows.length; i += INSERT_BATCH_SIZE) {
      const batch = insertRows.slice(i, i + INSERT_BATCH_SIZE);
      await insertChunkBatch(batch);
    }
  } catch (e) {
    await supabase.from("documents").delete().eq("id", documentId);
    const message = e instanceof Error ? e.message : "unknown error";
    throw new Error(`Failed to insert chunks: ${message}`);
  }

  return { documentId, title, chunkCount: chunks.length };
}

async function insertChunkBatch(
  rows: Array<{
    document_id: string;
    chunk_index: number;
    content: string;
    embedding: string;
  }>,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  for (let attempt = 1; attempt <= MAX_INSERT_RETRIES; attempt++) {
    const { error } = await supabase.from("document_chunks").insert(rows);

    if (!error) return;
    if (attempt === MAX_INSERT_RETRIES) {
      throw new Error(error.message);
    }

    await sleep(400 * attempt);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
