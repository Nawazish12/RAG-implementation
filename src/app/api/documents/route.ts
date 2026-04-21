import { NextResponse } from "next/server";
import { ingestFile } from "@/lib/ingest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("documents")
      .select("id, title, filename, mime_type, byte_size, created_at, document_chunks(count)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const documents = (data ?? []).map((row: Record<string, unknown>) => {
      const rel = row.document_chunks as { count: number }[] | null | undefined;
      const count = Array.isArray(rel) && rel[0] ? Number(rel[0].count) : 0;
      const rest = Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== "document_chunks"),
      );
      return { ...rest, chunk_count: count };
    });

    return NextResponse.json({ documents });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Expected form field `file` (File)." }, { status: 400 });
    }

    const titleField = form.get("title");
    const title = typeof titleField === "string" ? titleField : undefined;

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || guessMimeType(file.name);

    const result = await ingestFile({
      buffer,
      filename: file.name || "upload",
      mimeType,
      title,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function guessMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}
