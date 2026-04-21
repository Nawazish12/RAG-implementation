import OpenAI from "openai";
import { getEnv } from "@/lib/env";

const BATCH = 64;

export async function embedQuery(text: string): Promise<number[]> {
  const env = getEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const res = await openai.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: text,
  });

  const v = res.data[0]?.embedding;
  if (!v) throw new Error("Embedding API returned no vector");
  return v;
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const env = getEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await openai.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: batch,
    });

    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const row of sorted) {
      if (!row.embedding) throw new Error("Embedding row missing vector");
      out.push(row.embedding);
    }
  }

  return out;
}
