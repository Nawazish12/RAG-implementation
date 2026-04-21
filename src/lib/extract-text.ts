import pdfParse from "pdf-parse";

const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
]);

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const type = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (TEXT_TYPES.has(type) || type.endsWith("+json")) {
    return buffer.toString("utf-8");
  }

  if (type === "application/pdf") {
    const parsed = await pdfParse(buffer);
    return parsed.text ?? "";
  }

  throw new Error(`Unsupported file type for ingestion: ${mimeType}`);
}
