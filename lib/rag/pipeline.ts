import { OpenAiProvider } from "@/lib/llm/openai";
import { buildPageChunks } from "@/lib/rag/chunk";
import { retrieveTopK } from "@/lib/rag/retrieve";
import { extractPagesFromPdf } from "@/lib/pdf/extract";
import { saveIndex } from "@/lib/storage";
import type { FileIndex } from "@/lib/types";

export async function buildIndexForPdf(input: {
  fileId: string;
  filename: string;
  bytes: Uint8Array;
}): Promise<FileIndex> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const provider = new OpenAiProvider(apiKey);
  const pages = await extractPagesFromPdf(input.bytes);
  const rawChunks = buildPageChunks(pages);
  const embeddings = await provider.embed(rawChunks.map((chunk) => chunk.text));

  const index: FileIndex = {
    fileId: input.fileId,
    filename: input.filename,
    createdAt: new Date().toISOString(),
    pages,
    chunks: rawChunks.map((chunk, idx) => ({
      id: chunk.id,
      page: chunk.page,
      text: chunk.text,
      embedding: embeddings[idx] ?? []
    }))
  };

  await saveIndex(index);
  return index;
}

export async function answerFromIndex(input: {
  question: string;
  index: FileIndex;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const provider = new OpenAiProvider(apiKey);
  const [queryEmbedding] = await provider.embed([input.question]);
  const topChunks = retrieveTopK(input.index.chunks, queryEmbedding, 5);

  return provider.answerQuestion({
    question: input.question,
    topChunks,
    pages: input.index.pages
  });
}
