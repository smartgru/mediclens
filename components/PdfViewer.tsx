"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Citation } from "@/lib/types";

type TextItem = {
  str: string;
  transform: [number, number, number, number, number, number];
  width: number;
};

type ViewTextSpan = {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

type PageRender = {
  width: number;
  height: number;
  canvasDataUrl: string;
  spans: ViewTextSpan[];
};

function canonicalizeChar(input: string): string {
  if (/[\u2018\u2019]/.test(input)) return "'";
  if (/[\u201c\u201d]/.test(input)) return '"';
  if (/[\u2012\u2013\u2014\u2015]/.test(input)) return "-";
  return input.toLowerCase();
}

function normalizeWithMap(
  input: string,
  options?: { removeWhitespace?: boolean }
): { normalized: string; map: number[] } {
  let normalized = "";
  const map: number[] = [];
  let lastWasSpace = false;
  const removeWhitespace = options?.removeWhitespace === true;

  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    const isSpace = /\s/.test(c);

    if (isSpace) {
      if (removeWhitespace) continue;
      if (!lastWasSpace) {
        normalized += " ";
        map.push(i);
      }
      lastWasSpace = true;
    } else {
      normalized += canonicalizeChar(c);
      map.push(i);
      lastWasSpace = false;
    }
  }

  return { normalized, map };
}

function findSpanIndexesForQuote(spans: ViewTextSpan[], quote: string): Set<number> {
  const raw = spans.map((s) => s.text).join("");
  if (!raw || !quote.trim()) return new Set<number>();

  const rawNorm = normalizeWithMap(raw);
  const quoteNorm = normalizeWithMap(quote);
  const quoteTrimmed = quoteNorm.normalized.trim();
  let matchStartNorm = rawNorm.normalized.indexOf(quoteTrimmed);
  let activeMap = rawNorm.map;
  let matchEndNorm = matchStartNorm + quoteTrimmed.length - 1;

  if (matchStartNorm === -1) {
    const rawCompact = normalizeWithMap(raw, { removeWhitespace: true });
    const quoteCompact = normalizeWithMap(quote, { removeWhitespace: true });
    matchStartNorm = rawCompact.normalized.indexOf(quoteCompact.normalized);
    if (matchStartNorm === -1) return new Set<number>();
    matchEndNorm = matchStartNorm + quoteCompact.normalized.length - 1;
    activeMap = rawCompact.map;
  }

  const rawStart = activeMap[matchStartNorm] ?? 0;
  const rawEnd = activeMap[matchEndNorm] ?? raw.length - 1;

  const result = new Set<number>();
  let offset = 0;

  spans.forEach((span, index) => {
    const start = offset;
    const end = offset + span.text.length - 1;
    const overlaps = end >= rawStart && start <= rawEnd;
    if (overlaps) result.add(index);
    offset += span.text.length;
  });

  return result;
}

type PdfJsModule = typeof import("pdfjs-dist");
type PdfDocument = Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>;

export function PdfViewer({
  pdfUrl,
  citations,
  jumpPage,
  jumpSignal
}: {
  pdfUrl: string;
  citations: Citation[];
  jumpPage: number | null;
  jumpSignal: number;
}) {
  const [pdfjs, setPdfjs] = useState<PdfJsModule | null>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageRender, setPageRender] = useState<PageRender | null>(null);
  const loadToken = useRef(0);

  useEffect(() => {
    let mounted = true;

    import("pdfjs-dist").then((mod) => {
      if (!mounted) return;
      mod.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${mod.version}/pdf.worker.min.mjs`;
      setPdfjs(mod);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!pdfjs) return;
    let cancelled = false;

    (async () => {
      const loadingTask = pdfjs.getDocument(pdfUrl);
      const loaded = await loadingTask.promise;
      if (cancelled) return;
      setDoc(loaded);
      setPageNumber(1);
    })().catch(() => {
      setDoc(null);
    });

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, pdfjs]);

  useEffect(() => {
    if (!doc || !jumpPage) return;
    if (jumpPage >= 1 && jumpPage <= doc.numPages) {
      setPageNumber(jumpPage);
    }
  }, [doc, jumpPage, jumpSignal]);

  useEffect(() => {
    if (!doc || !pdfjs) return;

    const token = ++loadToken.current;

    (async () => {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;

      const text = await page.getTextContent();
      const rawItems = text.items as unknown[];
      const spans: ViewTextSpan[] = rawItems
        .filter((item): item is TextItem => {
          return typeof item === "object" && item !== null && "str" in item && "transform" in item;
        })
        .map((item) => {
          const tx = pdfjs.Util.transform(viewport.transform, item.transform);
          const left = tx[4];
          const top = tx[5] - Math.abs(tx[3]);
          const height = Math.abs(tx[3]) || 10;
          const width = item.width * viewport.scale;

          return {
            text: item.str,
            left,
            top,
            width,
            height
          };
        });

      if (loadToken.current !== token) return;

      setPageRender({
        width: viewport.width,
        height: viewport.height,
        canvasDataUrl: canvas.toDataURL("image/png"),
        spans
      });
    })().catch(() => {
      setPageRender(null);
    });
  }, [doc, pageNumber, pdfjs]);

  const highlightedSpanIndexes = useMemo(() => {
    if (!pageRender) return new Set<number>();

    const citationsOnPage = citations.filter((citation) => citation.page === pageNumber);
    const merged = new Set<number>();

    for (const citation of citationsOnPage) {
      const indexes = findSpanIndexesForQuote(pageRender.spans, citation.quote);
      indexes.forEach((idx) => merged.add(idx));
    }

    return merged;
  }, [citations, pageNumber, pageRender]);

  if (!doc) {
    return <div className="small">Loading PDF...</div>;
  }

  return (
    <div className="viewer-shell">
      <div className="viewer-toolbar">
        <div className="row">
          <button type="button" onClick={() => setPageNumber((p) => Math.max(1, p - 1))}>
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.min(doc.numPages, p + 1))}
          >
            Next
          </button>
        </div>
        <div className="small">
          Page {pageNumber} / {doc.numPages}
        </div>
      </div>

      <div className="viewer-page">
        {pageRender ? (
          <div className="pdf-page" style={{ width: pageRender.width, height: pageRender.height }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pageRender.canvasDataUrl} alt={`PDF page ${pageNumber}`} width={pageRender.width} height={pageRender.height} />
            <div className="text-layer" aria-hidden="true">
              {pageRender.spans.map((span, index) => (
                <span
                  key={`${index}-${span.left}-${span.top}`}
                  className={`text-span ${highlightedSpanIndexes.has(index) ? "highlighted" : ""}`}
                  style={{
                    left: span.left,
                    top: span.top,
                    width: span.width,
                    height: span.height,
                    fontSize: span.height,
                    lineHeight: `${span.height}px`
                  }}
                >
                  {span.text}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="small">Rendering page...</div>
        )}
      </div>
    </div>
  );
}
