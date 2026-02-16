import OpenAI from "openai";
import { z } from "zod";
import type { AskResponse, ChunkIndex, PageIndex } from "@/lib/types";
import type { LlmProvider } from "@/lib/llm/provider";

const citationSchema = z.object({
  page: z.number().int().min(1),
  quote: z.string().min(1),
  confidence: z.number().min(0).max(1)
});

const askResponseSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(citationSchema)
});

function buildContext(topChunks: ChunkIndex[]): string {
  return topChunks
    .map((chunk) => `Page ${chunk.page}:\n${chunk.text}`)
    .join("\n\n---\n\n");
}

function normalizeForMatch(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function includesLoose(pageText: string, quote: string): boolean {
  const pageNorm = normalizeForMatch(pageText);
  const quoteNorm = normalizeForMatch(quote);
  if (!quoteNorm) return false;
  if (pageNorm.includes(quoteNorm)) return true;

  // Handle PDFs where extractor spacing is inconsistent between spans.
  const pageCompact = pageNorm.replace(/\s+/g, "");
  const quoteCompact = quoteNorm.replace(/\s+/g, "");
  return quoteCompact.length > 0 && pageCompact.includes(quoteCompact);
}

function validateCitationsExist(output: AskResponse, pages: PageIndex[]): AskResponse {
  const byPage = new Map<number, string>();
  for (const page of pages) {
    byPage.set(page.pageNumber, page.text);
  }

  const citations = output.citations.filter((citation) => {
    const pageText = byPage.get(citation.page);
    if (!pageText) return false;
    return includesLoose(pageText, citation.quote);
  });

  return {
    answer: output.answer,
    citations
  };
}

export class OpenAiProvider implements LlmProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: texts
    });

    return response.data.map((row) => row.embedding);
  }

  async answerQuestion(input: {
    question: string;
    topChunks: ChunkIndex[];
    pages: PageIndex[];
  }): Promise<AskResponse> {
    const system = [
      "You answer medical-record questions using only provided context.",
      "Return STRICT JSON only matching schema:",
      '{"answer":"string","citations":[{"page":number,"quote":"string","confidence":0-1}]}.',
      "Quote must be verbatim and present on cited page.",
      "If context is insufficient, say so and return empty citations."
    ].join(" ");

    const user = [
      `Question: ${input.question}`,
      "Context:",
      buildContext(input.topChunks)
    ].join("\n\n");

    const completion = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Model returned empty response");
    }

    const parsed = askResponseSchema.parse(JSON.parse(content));
    return validateCitationsExist(parsed, input.pages);
  }
}
