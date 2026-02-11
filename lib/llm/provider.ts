import type { AskResponse, ChunkIndex, PageIndex } from "@/lib/types";

export interface LlmProvider {
  embed(texts: string[]): Promise<number[][]>;
  answerQuestion(input: {
    question: string;
    topChunks: ChunkIndex[];
    pages: PageIndex[];
  }): Promise<AskResponse>;
}
