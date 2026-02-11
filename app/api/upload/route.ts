import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildIndexForPdf } from "@/lib/rag/pipeline";
import { savePdf } from "@/lib/storage";
import { isRateLimited } from "@/lib/rate-limit";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

export async function POST(req: NextRequest) {
  if (process.env.VERCEL === "1" && !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Persistent storage is not configured. Set BLOB_READ_WRITE_TOKEN in Vercel project settings."
      },
      { status: 500 }
    );
  }

  const ip = getClientIp(req);
  if (isRateLimited(`upload:${ip}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 25MB limit" }, { status: 400 });
  }

  const fileId = randomUUID();
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    await savePdf(fileId, bytes);
    await buildIndexForPdf({
      fileId,
      filename: file.name,
      bytes
    });

    return NextResponse.json({ fileId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
