import fs from "node:fs/promises";
import path from "node:path";
import { head, put } from "@vercel/blob";
import { FileIndex } from "@/lib/types";

function resolveStorageRoot(): string {
  if (process.env.STORAGE_ROOT_DIR) {
    return process.env.STORAGE_ROOT_DIR;
  }

  // Vercel runtime code directory (/var/task) is read-only. Use /tmp instead.
  if (process.env.VERCEL === "1") {
    return "/tmp/mediclens";
  }

  return process.cwd();
}

const rootDir = resolveStorageRoot();
const uploadDir = path.join(rootDir, "uploads");
const indexDir = path.join(rootDir, "data", "indexes");

function isBlobStorageEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function getBlobUploadPath(fileId: string): string {
  return `uploads/${fileId}.pdf`;
}

function getBlobIndexPath(fileId: string): string {
  return `indexes/${fileId}.json`;
}

export function getUploadPath(fileId: string): string {
  return path.join(uploadDir, `${fileId}.pdf`);
}

export function getIndexPath(fileId: string): string {
  return path.join(indexDir, `${fileId}.json`);
}

export async function ensureStorageDirs(): Promise<void> {
  if (isBlobStorageEnabled()) return;
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(indexDir, { recursive: true });
}

export async function savePdf(
  fileId: string,
  bytes: Uint8Array,
): Promise<string> {
  if (isBlobStorageEnabled()) {
    const blobPath = getBlobUploadPath(fileId);
    await put(blobPath, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/pdf",
    });
    return blobPath;
  }

  await ensureStorageDirs();
  const filePath = getUploadPath(fileId);
  await fs.writeFile(filePath, bytes);
  return filePath;
}

export async function saveIndex(index: FileIndex): Promise<void> {
  if (isBlobStorageEnabled()) {
    const blobPath = getBlobIndexPath(index.fileId);
    await put(blobPath, JSON.stringify(index), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }

  await ensureStorageDirs();
  const indexPath = getIndexPath(index.fileId);
  await fs.writeFile(indexPath, JSON.stringify(index));
}

export async function readIndex(fileId: string): Promise<FileIndex | null> {
  if (isBlobStorageEnabled()) {
    try {
      const blob = await head(getBlobIndexPath(fileId));
      const response = await fetch(blob.url, { cache: "no-store" });
      if (!response.ok) return null;

      const raw = await response.text();
      return JSON.parse(raw) as FileIndex;
    } catch {
      return null;
    }
  }

  try {
    const raw = await fs.readFile(getIndexPath(fileId), "utf-8");
    return JSON.parse(raw) as FileIndex;
  } catch {
    return null;
  }
}

export async function readPdf(fileId: string): Promise<Buffer | null> {
  if (isBlobStorageEnabled()) {
    try {
      const blob = await head(getBlobUploadPath(fileId));
      const response = await fetch(blob.url, { cache: "no-store" });
      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  try {
    return await fs.readFile(getUploadPath(fileId));
  } catch {
    return null;
  }
}
