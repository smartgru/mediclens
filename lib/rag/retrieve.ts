import type { ChunkIndex } from "@/lib/types";
import { cosineSimilarity } from "@/lib/rag/vector";

export function retrieveTopK(chunks: ChunkIndex[], queryEmbedding: number[], k = 5): ChunkIndex[] {
  return [...chunks]
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(chunk.embedding, queryEmbedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((row) => row.chunk);
}
