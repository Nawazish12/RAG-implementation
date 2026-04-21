import { streamText, type CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { getEnv } from "@/lib/env";
import { formatContextForPrompt, retrieveChunks } from "@/lib/rag";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: unknown;
};

type TextPart = {
  type: "text";
  text: string;
};

function isTextPart(value: unknown): value is TextPart {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "text" in value &&
    value.type === "text" &&
    typeof value.text === "string"
  );
}

function getLatestUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    const text = getMessageText(m.content);
    if (text) return text;
  }
  return "";
}

function getMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content.filter(isTextPart).map((p) => p.text).join("\n");
}

function toCoreMessages(messages: ChatMessage[]): CoreMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== "user" && message.role !== "assistant") {
      return [];
    }

    const content = getMessageText(message.content);
    if (!content.trim()) return [];

    return [{ role: message.role, content }];
  });
}

export async function POST(req: Request) {
  try {
    const env = getEnv();
    const body = await req.json();
    const messages = (body.messages ?? []) as ChatMessage[];

    const query = getLatestUserText(messages);
    const chunks = query.trim().length > 0 ? await retrieveChunks(query, 8) : [];
    const context = formatContextForPrompt(chunks);

    const system = [
      "You are a retrieval-augmented assistant.",
      "Ground answers in the CONTEXT when it is relevant.",
      "If CONTEXT is missing or insufficient, say so explicitly and answer only with general knowledge if needed.",
      "When you use CONTEXT, cite sources like [Source 1], matching the Source numbers in the CONTEXT blocks.",
      "",
      "CONTEXT:",
      context,
    ].join("\n");

    const result = streamText({
      model: openai(env.OPENAI_CHAT_MODEL),
      system,
      messages: toCoreMessages(messages),
    });

    return result.toDataStreamResponse();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
