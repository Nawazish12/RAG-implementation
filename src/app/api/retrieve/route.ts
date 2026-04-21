import { NextResponse } from "next/server";
import { z } from "zod";
import { retrieveChunks } from "@/lib/rag";

export const runtime = "nodejs";

const bodySchema = z.object({
  query: z.string().min(1).max(8000),
  matchCount: z.number().int().min(1).max(32).optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const chunks = await retrieveChunks(parsed.data.query, parsed.data.matchCount ?? 8);
    return NextResponse.json({ chunks });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
