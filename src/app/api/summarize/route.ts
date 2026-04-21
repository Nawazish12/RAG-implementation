import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  documentId: z.string().uuid(),
});

const MAX_CHARS = 120_000;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const env = getEnv();
    const supabase = getSupabaseAdmin();

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, title")
      .eq("id", parsed.data.documentId)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const { data: chunks, error: chErr } = await supabase
      .from("document_chunks")
      .select("chunk_index, content")
      .eq("document_id", parsed.data.documentId)
      .order("chunk_index", { ascending: true });

    if (chErr) {
      return NextResponse.json({ error: chErr.message }, { status: 500 });
    }

    const rows = chunks ?? [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "No chunks for this document." }, { status: 400 });
    }

    const corpus = rows
      .map((c) => `### Chunk ${c.chunk_index}\n${c.content}`)
      .join("\n\n")
      .slice(0, MAX_CHARS);

    const { text } = await generateText({
      model: openai(env.OPENAI_CHAT_MODEL),
      system:
        "You summarize documents clearly and accurately for a developer audience. Use markdown with short sections and bullet points when helpful.",
      prompt: `Summarize the following document titled "${doc.title}".\n\n${corpus}`,
    });

    return NextResponse.json({
      title: doc.title as string,
      chunkCount: rows.length,
      summary: text,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
