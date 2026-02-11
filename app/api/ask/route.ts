import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { answerFromIndex } from "@/lib/rag/pipeline";
import { readIndex } from "@/lib/storage";
import { isRateLimited } from "@/lib/rate-limit";

const schema = z.object({
  fileId: z.string().min(1),
  question: z.string().min(3).max(2000)
});

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
  if (isRateLimited(`ask:${ip}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const index = await readIndex(parsed.data.fileId);
  if (!index) {
    return NextResponse.json({ error: "Unknown fileId" }, { status: 404 });
  }

  try {
    const result = await answerFromIndex({
      question: parsed.data.question,
      index
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ask failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
