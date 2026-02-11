import { NextRequest, NextResponse } from "next/server";
import { readPdf } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: { fileId: string } },
) {
  const pdf = await readPdf(params.fileId);

  if (!pdf) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store",
    },
  });
}
