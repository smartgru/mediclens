"use client";

import { FormEvent, useMemo, useState } from "react";
import { PdfViewer } from "@/components/PdfViewer";
import type { Citation } from "@/lib/types";

type AskResponse = {
  answer: string;
  citations: Citation[];
};

export default function HomePage() {
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [jumpSignal, setJumpSignal] = useState(0);

  const firstCitationPage = useMemo(() => {
    return result?.citations?.[0]?.page ?? null;
  }, [result]);

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const selected = input?.files?.[0];

    if (!selected) {
      setError("Please choose a PDF file.");
      return;
    }

    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", selected);

      const res = await fetch("/api/upload", {
        method: "POST",
        body,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");

      setFileId(data.fileId);
      setFileName(selected.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (asking) return;
    if (!fileId) {
      setError("Upload a PDF first.");
      return;
    }

    setError(null);
    setAsking(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId, question }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to get answer");

      setResult(data as AskResponse);
      setJumpSignal((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setAsking(false);
    }
  }

  return (
    <main>
      <h1>MedicLens MVP</h1>
      <p className="small">Not medical advice. For informational use only.</p>

      <div className="grid main-content">
        <section className="card">
          <h2>Upload PDF</h2>
          <form onSubmit={onUpload} className="row">
            <input name="file" type="file" accept="application/pdf" />
            <button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
          {fileId && (
            <p className="small">
              Uploaded: <strong>{fileName}</strong>
            </p>
          )}

          <hr />

          <h2>Ask Question</h2>
          <form onSubmit={onAsk}>
            <div className="row" style={{ width: "100%" }}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about the medical record..."
                disabled={!fileId || asking}
              />
              <button
                type="submit"
                disabled={!fileId || !question.trim() || asking}
              >
                {asking ? "Asking..." : "Ask"}
              </button>
            </div>
          </form>

          {error && <p className="error">{error}</p>}

          {result && (
            <div>
              <h3>Answer</h3>
              <div className="answer">{result.answer}</div>
              <h3 style={{ marginTop: 16 }}>Citations</h3>
              {result.citations.length > 0 ? (
                <ul className="small">
                  {result.citations.map((citation, index) => (
                    <li key={`${citation.page}-${citation.quote}-${index}`}>
                      Page {citation.page}: &quot;{citation.quote}&quot;
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small">No citations returned. Viewer jump requires at least one citation.</p>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <h2>Document Viewer</h2>
          {fileId ? (
            <PdfViewer
              pdfUrl={`/api/file/${fileId}`}
              citations={result?.citations ?? []}
              jumpPage={firstCitationPage}
              jumpSignal={jumpSignal}
            />
          ) : (
            <p className="small">Upload a PDF to view it.</p>
          )}
        </section>
      </div>
    </main>
  );
}
