import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PageIndex } from "@/lib/types";

type PdfTextItem = {
  str: string;
  width: number;
  height: number;
  transform: [number, number, number, number, number, number];
};

function isTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item
  );
}

export async function extractPagesFromPdf(
  bytes: Uint8Array,
): Promise<PageIndex[]> {
  const loadingTask = getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pages: PageIndex[] = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const rawItems = textContent.items as unknown[];

    const spans = rawItems.filter(isTextItem).map((item) => {
      const [, , , d, e, f] = item.transform;
      const height = Math.abs(d) || item.height || 12;

      return {
        text: item.str,
        x: e,
        y: f - height,
        width: item.width,
        height,
      };
    });

    const pageText = spans.map((span) => span.text).join("");

    pages.push({
      pageNumber: i,
      text: pageText,
      spans,
    });
  }

  return pages;
}
