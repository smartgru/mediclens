import type { PageIndex } from "@/lib/types";

export type RawChunk = {
  id: string;
  page: number;
  text: string;
};

export function buildPageChunks(pages: PageIndex[]): RawChunk[] {
  return pages
    .map((page) => ({
      id: `p${page.pageNumber}`,
      page: page.pageNumber,
      text: page.text.replace(/\s+/g, " ").trim()
    }))
    .filter((chunk) => chunk.text.length > 0);
}
